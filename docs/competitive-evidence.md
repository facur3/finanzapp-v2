# Competitive evidence record, 2026-10-02

**What this is.** The durable, per-claim evidence behind the matrix in [competitive-landscape.md](competitive-landscape.md)
§3–§4 (Producto 25DISC1). For each of the ten audited products: every capability the researcher checked, the status
after the second, adversarial reader's corrections, a one-line paraphrase of what the source says, and the public
source(s) read. It replaces the session-only research record the landscape used to point to.

How to use it:
- **Trace a matrix cell.** Find the product's section, then the capability (the audit's wording; the matrix groups and
  renames some rows). The status symbols are the matrix's: ● offered · ◐ partial or limited · ○ not offered (evidence
  of absence) · ? unverified. `2nd reader:` marks a status or note the verification pass changed, with its reason.
- **Rows marked `added`** were found by the second reader, not the first audit.
- **Before any decision** that depends on a claim, re-open its source: prices, versions and features change weekly.
  Dates are as read on 2026-10-02 (some storefronts re-read on 2026-10-03).
- **Paraphrases only.** No competitor copy, UI or asset is reproduced; a quoted word is a label the source uses.
- Where this record and the landscape differ, the landscape was edited deliberately after verification (its §3 notes
  say why) or is wrong: fix whichever the source contradicts.
- Mercado Pago, bank-connection and shared-expense research (landscape §7, §9, §11) cites its sources inline and in
  landscape §13; it is not repeated here.


## Kesef

Product as audited: Kesef (App Store: "Kesef: Gestor de gastos" on AR storefront, "Kesef: Expense Tracker" on US; Google Play: com.kesef.app). Official site: https://www.getkesef.app/. Second reader's overall confidence: high.

Could not verify: Exact release date of 2.4.0: both storefronts show only 'hace 5 días' / '5d ago' on 2026-10-02; Google Play sh…; AR storefront in-app purchase list: the parse found Mensual USD 4.99 and Anual USD 34.99 but no Lifetime row;…; Whether CSV/JSON export is free: homepage and pricing table say free, FAQ says Pro (only local backup free).; AI chat: provider, cost limits and whether it is Pro-gated are not documented on the site, FAQ, privacy policy…; Mercado Pago integration is absent from the privacy policy and terms (last updated 2 Sep 2026); the exact OAut…; Whether manually entered foreign-currency movements keep the original amount (documented only for Mercado Pago…; Text search, custom date ranges, refunds handling, VoiceOver/Dynamic Type support, and Lock Screen widgets: no…; Which Shortcuts/App Intents are exposed beyond the Apple Pay transaction automation..

| Group | Capability | Status | What the source says | Sources |
| --- | --- | --- | --- | --- |
| Capture | manual entry | ● | Tap + to add expense or income; date field allows past or future movements; edit/delete from Actividad or Inicio. | S1 |
| Capture | voice capture | ● | Dictate expenses; audio plus the user's category names are sent to a transcription service (privacy policy names Groq). Pro feature with a free trial; Pro = unlimited voi… | S2, S3, S4 |
| Capture | multi-entry voice (several movements in one utterance) | ● | Store listing (1.2.0 notes and description) and homepage demo: one utterance like 'spent X at the super, Y on coffee and Z on fuel' yields 3 separate categorised expenses… | S5, S2, S6 |
| Capture | AI categorization | ◐ | Voice entries are auto-categorised by the LLM/transcription step using the user's category names. Mercado Pago imports get a merchant-suggested category that learns from… · 2nd reader: Voice page details what the recognition step fills in: category (from the user's own categories), account and payment method, currency (with conversio… | S2, S3, S7 |
| Capture | Apple Pay / Wallet Shortcut capture | ● | 2.4.0 release notes: an automation set up once in the Shortcuts app logs each Apple Pay payment with amount, merchant and date. | S5 |
| Capture | Dynamic Island / Live Activity | ○ | Not mentioned in store description, release notes, site or FAQ. | S5, S2 |
| Capture | WhatsApp / messaging capture | ○ | Not mentioned anywhere in listing, site, FAQ or blog. | S2, S1 |
| Capture | widgets (Home/Lock Screen) | ◐ | 2.0.0 added home-screen widgets 'to see your finances'. Lock Screen widgets not mentioned. · 2nd reader: 2.0.0 notes: 'Widgets para ver tus finanzas desde la pantalla de inicio'; the voice page adds that an expense can be loaded 'desde los widgets y los a… | S4, S7 |
| Capture | Quick Actions (home-screen long-press) | ● | 2.0.0 added Quick Actions for fast access; 2.4.0 added more 'atajos' for everyday actions. | S5 |
| Capture | external integrations / Shortcuts / App Intents | ● | 2.0.0 'Integración con Atajos de Apple (Shortcuts)'; 2.4.0 Apple Pay automation via Shortcuts. Specific intents exposed are not documented. | S5 |
| Organization | categories | ● | Categories with emoji icons; home shows month breakdown by category (amounts or percentages). | S1 |
| Organization | custom categories | ● | Configuración → Categorías → Agregar; pick any emoji; free plan includes category customisation. Custom payment methods also. | S1, S2 |
| Organization | tags | ● | Tags to identify, filter and group movements (since 1.2.0). Free plan limited to 3 tags; Pro unlimited. | S5, S1 |
| Organization | subcategories | ○ | Not offered; an AR review (4 days old) asks for a breakdown inside categories, and the site suggests tags for cross-cutting grouping instead. | S5, S2 |
| Organization | search | ? | FAQ mentions filters on the Actividad screen; a text search is not described. | S1 |
| Organization | filters | ● | Filters on the Actividad screen; tags are described as filterable; swipe between months. | S1 |
| Organization | merchant intelligence (normalisation, logos, rules) | ◐ | Subscription logos appear when the note contains a brand name (Netflix, Spotify). Mercado Pago imports: merchant-suggested category, learns from user corrections per merc… | S1, S2 |
| Organization | notes | ● | Movements have a note field (used to trigger subscription logos). | S1 |
| Organization | attachments / receipts | ○ | Kesef vs Splitwise table lists receipt scanning as 'No' for Kesef. | S8 |
| Spending / Money | accounts | ◐ | Has 'métodos de pago' the user defines and an optional 'arrastrar el balance' mode that makes the monthly balance behave like one running account. · 2nd reader: Stronger evidence that an 'account' entity exists: the voice page says voice entries auto-fill 'la cuenta y el método de pago con los que registrás ha… | S1, S5, S7, S3, S9 |
| Spending / Money | credit cards | ? (was ○) | No card entity: a review asks that credit spending not be deducted from balance but accumulate separately; blog treats card statements as education only. · 2nd reader: No official page describes a card entity, but the developer's reply on Google Play (update dated 8/9) to a reviewer asking for credit-card handling sa… | S5, S10, S11 |
| Spending / Money | statement cycles (closing/due dates) | ○ | Blog explains closing/due dates but no app feature for them is described. | S10 |
| Spending / Money | installments (cuotas) | ◐ | Homepage: a purchase in instalments is loaded once and Kesef spreads the cuota over N months (shows '3 de 12'); also in groups (one per month, same split). · 2nd reader: Confirmed on the homepage ('las compras en cuotas también se cargan una vez: Kesef reparte la cuota por los meses que dura', mock shows 'Cuotas sin in… | S2, S12, S11 |
| Spending / Money | refunds | ? | Not mentioned. | — |
| Spending / Money | early installment payoff | ○ | Not mentioned; instalments are a fixed N-month recurrence. | S2 |
| Spending / Money | recurring expenses | ● | Toggle 'Recurrencia' on a movement and pick a frequency; future ones are created automatically; free and unlimited. Recurring income (salary) too. · 2nd reader: Capability confirmed (FAQ 'Recurrencia' toggle, listing, homepage). But the 'free and unlimited' claim is contradicted by the Terms of Use (2 Sep 2026… | S1, S2, S13 |
| Spending / Money | subscriptions | ◐ | Subscriptions are recurring expenses with brand logos; the AI chat can answer 'how many active subscriptions'. No dedicated subscriptions manager described. | S1, S4 |
| Spending / Money | debts / receivables (personal loans) | ◐ | Only via group balances (who owes whom); no standalone personal loan/receivable ledger. | S2 |
| Spending / Money | multiple currencies | ● | Per-movement currency (site: 60+, listing: 55+), a display currency for totals and a default movement currency. Free. · 2nd reader: Count correction: the site (homepage, /multimoneda, comparisons, blog) now says 'más de 150 monedas'; the App Store/Play description still says '+55 m… | S1, S5, S2, S14 |
| Spending / Money | FX semantics | ● (was ◐) | Rate source: 'cotización oficial de DolarApp'. Listing says amounts are converted at the current rate and saved in the local currency; the Mercado Pago section says each… · 2nd reader: The dedicated multicurrency page states explicitly that every movement is stored in the currency it was paid in, that the conversion is taken at the m… | S1, S2, S4, S14, S15 |
| Spending / Money | cash flow view | ◐ | Home shows month income vs expenses and balance; optional carry-over balance mode; 'Mostrar ingresos' toggle. No explicit cash-flow report. | S1 |
| Spending / Money | future commitments / upcoming payments | ◐ | Recurring and instalments pre-populate next month ('ver el mes que viene antes de que llegue'); Pro insights project end-of-month balance. | S16, S1 |
| Budgeting / Planning | total budget | ? | Only per-category budgets are described. | S1 |
| Budgeting / Planning | category budgets | ● | Enable 'Presupuesto' on a category with a monthly limit; progress in real time and alerts near the limit. Free plan: 3 budgets; Pro unlimited. | S1, S2 |
| Budgeting / Planning | goals | ○ | Not offered; a Play review asks for a section to record savings from salary. | S2 |
| Budgeting / Planning | flexible vs fixed budgets / rollover | ◐ | Budgets repeat automatically into future months; no rollover of unspent amounts described. Separate 'arrastrar el balance' setting carries the month balance. | S1 |
| Budgeting / Planning | pay-cycle periods (custom month start / salary cycles) | ○ | Everything is organised by calendar month (swipe between months); no custom period start mentioned. | S1 |
| Budgeting / Planning | calendar view | ○ | Not mentioned; streak view shows a weekday strip only. | S2 |
| Budgeting / Planning | projections / forecasts | ● | Pro insights: end-of-month balance projection, spending pattern detection, saving suggestions. | S1 |
| Budgeting / Planning | reminders | ● | Optional daily notification to log expenses (max once a day) tied to streaks; group members can be nudged once a day about what they owe. No bill-due reminders. | S2, S1 |
| Reporting | by category | ● | Home chart by category with amounts/percentages; tap for detail. | S1 |
| Reporting | daily | ◐ | Insights show 'días de mayor consumo'; no daily report screen described. | S1 |
| Reporting | trends over time | ◐ | Insights grouped by week, month and year; monthly summary in Excel export. | S1 |
| Reporting | period comparisons | ● | Insights compare periods; chat can answer 'how am the researcher doing vs last month'. | S1, S4 |
| Reporting | by merchant | ○ | Not mentioned. | S1 |
| Reporting | subscriptions report | ◐ | Only via chat question about active subscriptions; no report described. | S4 |
| Reporting | calendar report | ○ | Not mentioned. | S1 |
| Reporting | custom date ranges | ? | Month swipe and Actividad filters exist; arbitrary ranges not described. | S1 |
| Reporting | AI-generated reports | ◐ | 'Insights' (basic free, detailed Pro) with pattern detection and suggestions; a Play review calls them 'insights con IA'. Mechanism not documented. | S1, S2 |
| Reporting | explain / query financial data in natural language | ● | 2.2.0 added a Chat module to 'converse with your data' (spend by category, active subscriptions, vs last month). Provider, limits and Pro gating are not documented on sit… · 2nd reader: Only the 2.2.0 release notes describe the Chat module; the site, FAQ, terms and privacy do not mention it and the privacy policy names Groq only for v… | S4, S5, S3 |
| Collaboration | split expenses | ● | Groups tab; free and unlimited; group has a default split that any expense can override. | S2, S5 |
| Collaboration | equal split | ● | 'partes iguales'. | S5 |
| Collaboration | percentage split | ● | 'por porcentaje'. | S5 |
| Collaboration | share-based split | ● | 'por partes' / 'by shares'. | S4 |
| Collaboration | exact-amount split | ● | 'montos exactos'. | S5 |
| Collaboration | groups | ● | Groups per currency, recurring and instalment group expenses, statistics, voice entry, archive when settled, sync across members. | S2 |
| Collaboration | invitations / participants without accounts | ● | Add a person by name and log their expenses before they join; invite by link or 8-character code; when they join they claim that slot and inherit history. | S1, S2 |
| Collaboration | household / partner shared finances | ◐ | Couples/roommates handled as a 2-person group with recurring shared costs; only your share counts in your own ledger. Not a fully shared household ledger. | S2 |
| Collaboration | debt simplification | ● | Settles with the fewest transfers; optional simplification of crossed debts (A owes B, B owes C → A pays C). | S2, S1 |
| Automation | Apple Pay capture automation | ● | Shortcuts automation on Apple Pay transactions logs amount, merchant, date (2.4.0). iOS only. | S5 |
| Automation | Mercado Pago sync | ● | Pro feature (2.3.0). Connect from Ajustes → Integraciones; authorisation happens on Mercado Pago's page (OAuth-style, password never passes through Kesef), revocable from… · 2nd reader: Re-verified on the homepage sections 'Pagás con Mercado Pago, se carga solo', 'Integración con Mercado Pago', 'Se conecta en dos minutos', 'Lo que ent… | S2, S5, S4 |
| Automation | bank sync (aggregator/open banking) | ○ | Listing: 'Sin conexión a bancos'; comparison tables list bank/card import as 'No'; blog argues against bank sync in LatAm. | S5, S17, S18 |
| Automation | imports (generic) | ● | Import history from another app via XLSX (Ajustes → Importar datos); re-import of a Kesef JSON backup. | S1, S2 |
| Automation | CSV import/export | ◐ | CSV export exists. Homepage and pricing say JSON/CSV export is free; the FAQ says CSV and JSON export are Pro and only the local backup is free (contradictory). · 2nd reader: Free CSV/JSON export is stated by the homepage (two places), pricing table, Terms ('exportarlo cuando quieras en JSON o CSV, sin costo'), Privacy ('En… | S2, S1, S13, S3, S5 |
| Automation | Excel import/export | ● | XLSX import free; XLSX export is Pro with three sheets (all movements, per-category summary, per-month summary). | S1 |
| Automation | JSON import/export | ● | JSON full backup (categories, accounts, tags, groups, budgets) to Files/iCloud Drive and re-import. Free per homepage; FAQ lists JSON export under Pro. | S2, S9, S1 |
| Automation | notification-based automation (reading bank/payment notifications) | ○ | Not offered; Mercado Pago uses an authorised API connection and Apple Pay uses Shortcuts, not notification reading. | S2 |
| Automation | recurring detection | ○ | Recurring must be set manually; no auto-detection described. | S1 |
| Privacy / Platform | local-first / on-device data | ● | Data lives on the phone; nothing leaves the device without an account except voice audio + category names. | S1, S3 |
| Privacy / Platform | account required or not | ○ (● = account required) | No account needed; optional Apple/Google sign-in only for sync, groups and the Mercado Pago connection. | S2 |
| Privacy / Platform | cloud sync | ● | With account: movements, categories, budgets sync across devices via Supabase servers in the US; free. | S1, S3 |
| Privacy / Platform | iCloud / CloudKit | ○ | Sync is through their own Supabase backend; iCloud only as a destination for the backup file. | S3, S1 |
| Privacy / Platform | Face ID / app lock | ● | Optional Face ID / fingerprint / device passcode lock; prompts on open and after 1 minute in background (2.3.0). | S1, S5 |
| Privacy / Platform | hidden amounts (privacy mode) | ○ | Not mentioned; only 'Mostrar ingresos' toggle. | S1 |
| Privacy / Platform | Apple Watch | ○ | Compatibility lists iPhone, iPad, iPod touch, Mac, Apple Vision; no watchOS. | S4 |
| Privacy / Platform | widgets | ● | Home-screen widgets since 2.0.0. | S4 |
| Privacy / Platform | accessibility (VoiceOver, Dynamic Type) evidence | ◐ | Developer-declared App Store accessibility: dark interface, differentiation without colour, sufficient contrast, reduced motion, captions. | S4 |
| Privacy / Platform | localization (languages, regions) | ● | Store: English, French, Portuguese, Spanish; app claims 50+ languages; site ES/EN; LatAm regional rate source (DolarApp). | S4 |
| Privacy / Platform | Android availability | ● | Google Play com.kesef.app, 2.4.0, updated 25 Sep 2026, 1K+ downloads, contains ads and IAP. · 2nd reader: Play listing read directly: 'Kesef: Gestor de gastos', developer Gonzalo Nahmias, 4.9 with 169 opiniones (audit said 168), 1 K+ descargas, 'Actualizac… | S19, S11 |
| Privacy / Platform | web availability | ○ | Site states 'Kesef es gratis y está en iPhone y Android'; no web app link. | S2 |
| Monetization | free tier and its limits | ● | Free, ad-supported: unlimited expenses/income, groups, recurring, sync, custom categories, 60+ currency conversion; 3 tags and 3 budgets max; basic insights; JSON/CSV exp… · 2nd reader: Update the note: 150+ currencies (site), 3 tags and 3 budgets free (FAQ and Terms), and the Terms additionally cap free at 3 active recurring movement… | S2, S1, S13, S3, S20 |
| Monetization | trial | ● | 14-day free trial on the annual plan; voice has a free trial. | S2 |
| Monetization | monthly price | ● | App Store IAP 'Mensual/Monthly' USD 4.99 on both AR (priced in USD) and US storefronts; site says USD 5/month. | S5, S2 |
| Monetization | annual price | ● | IAP 'Anual/Yearly' USD 34.99 (AR and US); site USD 35/year (USD 2.92/mo, -42%). | S4, S2 |
| Monetization | lifetime price | ● | IAP 'Kesef Lifetime' USD 99.99 on the US storefront; the AR storefront IAP list showed only Mensual and Anual in the fetch (lifetime may be hidden there). · 2nd reader: The AR storefront does list the lifetime IAP: 'Kesef Pro de por vida USD 99.99' alongside 'Anual USD 34.99' and 'Mensual USD 4.99' (all priced in USD… | S4, S5 |
| Monetization | what Pro gates (the meaningful boundary) | ● | Pro: Mercado Pago sync, unlimited voice capture, no ads, unlimited tags and budgets, detailed insights with end-of-month projection, Excel export (and CSV/JSON per FAQ). | S2, S1 |
| Future Finance | savings goals | ○ | Not offered; requested in a Play review. | S2 |
| Future Finance | investments | ○ | Not offered; Mercado Pago sync explicitly ignores moves to investments; an AR review requests a reserves/investments section. | S2, S5 |
| Future Finance | net worth | ○ | Not mentioned anywhere. | S2 |
| Future Finance | loans / mortgages | ○ | Not mentioned; debt blog is educational only. | S21 |
| Future Finance | assets (property, vehicles) | ○ | Not mentioned anywhere. | S2 |
| Capture | voice draft review before save (added) | ● | Everything recognised from a dictation appears as a list of editable drafts (amount, category, description, delete); nothing is saved until the person confirms. | S7 |
| Organization | payment methods (medios de pago) per movement (added) | ● | User-defined payment methods ('los métodos de pago los armás vos'); each movement stores 'medio de pago' per the privacy policy; voice entries auto-fill the usual account… | S2, S3, S7 |
| Collaboration | settlements recorded without touching the personal ledger (added) | ● | A settlement is logged inside the group and adjusts the balance; it counts neither as income nor as an expense in the personal summary. | S20 |
| Collaboration | per-expense split override and group statistics (added) | ● | Split type is chosen expense by expense (the group has a default); 2.2.0 added group statistics and voice entry of shared expenses; groups archive when settled and can be… | S20, S2, S4 |
| Collaboration | groups require the free account; no group/participant caps (added) | ● | Joining or creating a group needs the free Apple/Google account (the only place the app asks for one); free plan has no cap on groups or participants. | S20, S2 |
| Spending / Money | favorite currencies (added) | ● | 1.0.3 release notes: favourite currencies for quicker access. | S4 |
| Organization | category reordering (added) | ● | 1.0.3 release notes: reorder categories. | S4 |
| Privacy / Platform | RTL language support (added) | ● | 1.0.3 release notes: RTL support for applicable languages. | S4 |
| Privacy / Platform | tech stack evidence (Expo / React Native, Supabase, RevenueCat, AdMob, PostHog, Groq) (add… | ● | Privacy policy names Supabase (sync, US-hosted), Groq (voice transcription), PostHog (analytics), Google AdMob (ads), RevenueCat plus the stores (subscriptions), Expo (pu… | S3, S1 |
| Privacy / Platform | in-app data reset and account deletion (added) | ● | Configuración → Reiniciar datos wipes local data; Configuración → Perfil → Eliminar cuenta deletes the server copy immediately (group expenses stay visible to other membe… | S1, S3 |
| Privacy / Platform | theme (light/dark/auto) (added) | ● | Configuración → Tema: Claro, Oscuro or Automático. | S1 |
| Monetization | ads and tracking consent (added) | ● | Free tier shows AdMob ads; iOS asks ATT permission and serves less-personalised ads if refused; Pro removes ads. A 'Restaurar compras' button sits on the Pro (crown) scre… | S3, S1 |
| Reporting | insights grouped by week/month/year with collapsible sections (added) | ● | FAQ: insights organised by Semana, Mes and Año, each section collapsible; free shows a basic summary, Pro adds detailed analysis, month-end projection, pattern detection… | S1 |

Sources:

- S1: https://www.getkesef.app/preguntas-frecuentes
- S2: https://www.getkesef.app/
- S3: https://www.getkesef.app/privacy
- S4: https://apps.apple.com/us/app/kesef-expense-tracker/id6758053806
- S5: https://apps.apple.com/ar/app/kesef-gestor-de-gastos/id6758053806
- S6: https://www.getkesef.app/blog/cargar-gastos-por-voz-cuando-conviene
- S7: https://www.getkesef.app/cargar-gastos-por-voz
- S8: https://www.getkesef.app/kesef-vs-splitwise
- S9: https://www.getkesef.app/blog/exportar-tus-gastos
- S10: https://www.getkesef.app/blog/entender-el-resumen-de-la-tarjeta
- S11: https://play.google.com/store/apps/details?id=com.kesef.app&hl=es_AR
- S12: https://www.getkesef.app/blog/cuotas-sin-interes
- S13: https://www.getkesef.app/terms
- S14: https://www.getkesef.app/multimoneda
- S15: https://www.getkesef.app/blog/mejores-apps-de-gastos-2026
- S16: https://www.getkesef.app/blog/gastos-recurrentes
- S17: https://www.getkesef.app/kesef-vs-tricount
- S18: https://www.getkesef.app/blog/controlar-gastos-sin-conectar-el-banco
- S19: https://play.google.com/store/apps/details?id=com.kesef.app
- S20: https://www.getkesef.app/gastos-compartidos
- S21: https://www.getkesef.app/blog/salir-de-deudas
- S22: https://www.getkesef.app/blog
- S23: https://www.getkesef.app/blog/controlar-gastos-en-argentina

## MonAi

Product as audited: Expense Tracker - MonAi (AR storefront title: "Finanzas personales - MonAi"). Official site: https://get-monai.app/. Second reader's overall confidence: medium.

Could not verify: WhatsApp bot phone number and which subscription tier includes WhatsApp (the privacy policy's 'daily message c…; Whether the original foreign-currency amount is displayed on the transaction, the FX rate source, and whether…; The 'Advanced' $2.99 in-app purchase item: what it is (possibly a credit pack) and how 'Monthly' $7.99 / 'Year…; Exact year of App Store release dates (listing omits the year on current-year entries; 2026 inferred from orde…; Dynamic Island / Live Activity, Lock Screen widgets, Quick Actions, hidden-amounts mode, subcategories, goals,…; Accessibility support (App Store says the developer has not declared any); Android version number and Android IAP prices (Play page does not expose them without a signed-in client); https://get-monai.app/blog/choosing-a-mobile-expense-app-for-travelers returned 404 (the real slug is /blog/mo….

| Group | Capability | Status | What the source says | Sources |
| --- | --- | --- | --- | --- |
| Capture | manual entry | ● | Type naturally ('lunch $12', 'groceries 45.50 yesterday'); amount, date and category are extracted; drag a category onto the input to force it; time of day selectable sin… | S1, S2 |
| Capture | voice capture | ● | Core feature; Apple Speech framework transcribes, text goes to MonAi backend then OpenAI for interpretation; since 1.8.3 voice entries save without confirmation (opt-out)… · 2nd reader: Capability confirmed (App Store description, FAQ, home page). Two note details are unsupported: the terms page as fetched names OpenAI for voice/text… | S3, S4, S2, S5 |
| Capture | multi-entry voice (several movements in one utterance) | ● | FAQ example: one sentence with movies $19 and popcorn $4 is parsed into separate transactions with their own amounts/categories; App Store copy says it splits and categor… | S3, S2 |
| Capture | AI categorization | ● | Server-side (OpenAI) categorization for voice, text, Apple Pay (uses merchant name and, since 1.8.5, which card) and WhatsApp; learns from user corrections (sent with req… | S4, S6, S2 |
| Capture | Apple Pay / Wallet Shortcut capture | ● | Settings > 'Automatically Track Apple Pay' guided setup installs an Apple Shortcuts automation that logs a transaction on tap-to-pay at a terminal only (not online purcha… | S3, S6 |
| Capture | Dynamic Island / Live Activity | ? | No mention on the listing, FAQ, changelog or site. | — |
| Capture | WhatsApp / messaging capture | ● | New in 1.10.0 (iOS). User starts the link from the app's settings (requires a MonAi Account; data listed under account users); a pairing code with status ties the user's… · 2nd reader: Capability confirmed (App Store 1.10.0 What's New: message the MonAi bot by text or voice note and it lands as a transaction; terms/privacy section de… | S4, S2, S3 |
| Capture | widgets (Home/Lock Screen) | ◐ | Home Screen widgets since 1.4.0: mic/voice-entry widget, configurable budget overview and category-list widgets, shared-list widgets refreshed in background. | S6, S3, S7 |
| Capture | Quick Actions (home-screen long-press) | ? | Not mentioned anywhere. | — |
| Capture | external integrations / Shortcuts / App Intents | ● | App Intents since 1.1.0 (Siri 'New expense in MonAi', EN/DE); 'Transaction from prompt' Shortcut action used for SMS/email bank-message automations, Action Button voice,… | S1, S3, S6 |
| Organization | categories | ● | Emoji categories with colours; each category typed as income or expense (1.8.8); category bars on Home with long-press actions. | S6 |
| Organization | custom categories | ● | Create from the entry screen (+), drag-and-drop onto the input, custom emoji; redesigned picker with suggestions. | S2, S6 |
| Organization | tags | ● | #hashtag tags since 1.6.0, auto-suggested by AI or added manually; FAQ recommends them for payment methods, accounts and people. | S3, S6 |
| Organization | subcategories | ? | Not mentioned; tags are positioned as the way to slice beyond categories. | S3 |
| Organization | search | ● | Transaction list search by tag, text or amount; searches can be saved to drive the graph (1.6.0); AI Reports can search entries 'by meaning' (embeddings via OpenAI). | S6, S4 |
| Organization | filters | ◐ | Expense-only / income-only / both toggle, saved searches, period and custom-range selection; no richer filter UI described. | S6 |
| Organization | merchant intelligence (normalisation, logos, rules) | ◐ | AI assigns categories from the Apple Pay merchant name and card, with learning from corrections; no merchant logos or user-defined rules mentioned. | S3, S6 |
| Organization | notes | ◐ | Each transaction has a description text; no separate notes field evidenced. | S4 |
| Organization | attachments / receipts | ◐ | Home page advertises 'Photo → Transaction' (OCR extracts details via a Shortcut) and 'Screenshot → Entry'; no evidence the image is stored as an attachment. | S1 |
| Spending / Money | accounts | ○ | No account entity; FAQ tells users to track accounts (#checking, #savings) with tags, and the unit of organisation is a 'list' with one currency. | S3 |
| Spending / Money | credit cards | ○ | No card entity; FAQ suggests #creditcard tag; Apple Pay automation only notes which card was used for categorisation. | S3, S6 |
| Spending / Money | statement cycles (closing/due dates) | ○ | No accounts/cards exist; FAQ positions the app as intentionally minimalist and without advanced finance features. | S3 |
| Spending / Money | installments (cuotas) | ? | Not mentioned on any source. | — |
| Spending / Money | refunds | ? | Only App Store purchase refunds are discussed; no transaction-refund feature mentioned. | S3 |
| Spending / Money | early installment payoff | ? | Not mentioned. | — |
| Spending / Money | recurring expenses | ● | Set date + frequency (daily, weekly, bi-weekly, monthly, bi-monthly, quarterly); booked when the app is opened on/after the date; editing asks this one / all future / all… | S3, S6, S1 |
| Spending / Money | subscriptions | ◐ | Handled only as recurring transactions; no dedicated subscription tracker. | S3 |
| Spending / Money | debts / receivables (personal loans) | ? | Not mentioned. | — |
| Spending / Money | multiple currencies | ● | One base currency per list (since 1.7.6); separate lists for EUR vs USD; changing the list currency reformats but does not convert existing entries. | S3, S6 |
| Spending / Money | FX semantics | ◐ | Converted at entry: the iOS 'Currency Converter' (1.6.7) converts any amount from a chosen conversion currency into the list's base currency on the spot, for manual and A… · 2nd reader: Confirmed converted-at-entry: site changelog v1.6.7 says the converter turns any amount in the chosen conversion currency into the base currency, expl… | S6, S3, S4, S2 |
| Spending / Money | cash flow view | ◐ | Income/expense switch and a balance that resets to 0 each period unless Rollover is on; no dedicated cash-flow report. | S3, S6 |
| Spending / Money | future commitments / upcoming payments | ◐ | Recurrence screen shows upcoming occurrences (1.6.4); period picker scrolls into upcoming periods; Android lets you decide whether upcoming transactions are tracked. | S6 |
| Budgeting / Planning | total budget | ? (was ◐) | Budgets are per category with a 'budget overview' widget; no overall spending cap documented. · 2nd reader: No official source describes an overall spending cap. FAQ and App Store release notes only describe per-category limits with progress bars and a budge… | S6, S3, S5 |
| Budgeting / Planning | category budgets | ● | Since 1.8.1: monthly limits per category, progress bars, remaining budget shown while entering, overspend notifications, widgets; set via Settings > Budget or long-press… · 2nd reader: Confirmed; shipped in App Store 1.8.0 (Feb 4) with budget widgets, long-press actions and budget-aware AI suggestions; 1.8.1 (Feb 5) is a budget bug f… | S3, S6, S5 |
| Budgeting / Planning | goals | ? | Not mentioned. | — |
| Budgeting / Planning | flexible vs fixed budgets / rollover | ◐ | A global Rollover setting carries leftover balance/budget into the next month; otherwise balance resets to 0 each period. | S3 |
| Budgeting / Planning | pay-cycle periods | ● | 1.9.1: Home default period can be weekly, biweekly, semimonthly ('quincena') with custom start days, monthly with a custom start day, or all time; temporary overrides to… · 2nd reader: Confirmed; introduced in App Store version 1.9.0 (Jul 9), not 1.9.1 (Aug 3, which is fixes + plan overview). Semimonthly explicitly named for 'quincen… | S2, S6, S5 |
| Budgeting / Planning | calendar view | ? (was ◐) | A calendar button opens period/range pickers; no day-grid calendar of transactions; a reviewer requests one. · 2nd reader: The 'calendar' button (App Store 1.9.0 'calendar peek'; site changelog v1.9.1) only opens the period override picker (Month/Year/All time/Custom range… | S6, S1, S5 |
| Budgeting / Planning | projections / forecasts | ? | Not mentioned. | — |
| Budgeting / Planning | reminders | ◐ | Budget warning notifications; no daily logging reminder documented. | S3 |
| Reporting | by category | ● | Home shows category bars/graph with percentages for the chosen period. | S2, S6 |
| Reporting | daily | ◐ | Day totals on transaction-list section headers (1.7.4). | S6 |
| Reporting | trends over time | ◐ | Swipe through periods each with its own total; AI chat promises 'trend analysis'; no dedicated trend chart (FAQ: not for advanced charts). | S1, S3 |
| Reporting | period comparisons | ◐ | Only by browsing adjacent periods or asking the AI; no side-by-side comparison. | S6 |
| Reporting | by merchant | ? | Not mentioned. | — |
| Reporting | subscriptions report | ? | Only a settings list of recurring transactions. | S6 |
| Reporting | calendar report | ? | Not mentioned. | — |
| Reporting | custom date ranges | ● | Custom range picker with live summary (1.9.1). | S6 |
| Reporting | AI-generated reports | ● | 'AI Reports' (iOS open beta, Android planned): natural-language question returns a report with the numbers; uses Anthropic Claude Haiku 4.5 (Sonnet 5 in thorough mode); t… | S3, S4 |
| Reporting | explain / query financial data in natural language | ● | Chat-style questions ('How much did the researcher spend on food this month?'); semantic search over descriptions via OpenAI. | S3, S4 |
| Collaboration | split expenses | ◐ | Shared lists record each expense's creator; the total can be split evenly among participants, with participants groupable (e.g. a couple as one party). | S6, S1 |
| Collaboration | equal split | ● | Even split of the shared-list total among all participants (1.5.0). | S6 |
| Collaboration | percentage split | ○ | Changelog describes only an even split. | S6 |
| Collaboration | share-based split | ○ | Only even split documented. | S6 |
| Collaboration | exact-amount split | ○ | Only even split documented. | S6 |
| Collaboration | groups | ◐ | Shared lists act as groups; participants can be grouped for splitting. | S3, S6 |
| Collaboration | invitations / participants without accounts | ◐ | Invite via link; the other person must install MonAi and both 'should' create MonAi Accounts for reliable sync (legacy iCloud sharing exists). | S3 |
| Collaboration | household / partner shared finances | ● | Shared lists sync in real time; marketed to couples/roommates; Family plan via Apple Family Sharing / Google Family Library. | S1, S3 |
| Collaboration | debt simplification | ? | Not mentioned. | — |
| Automation | Apple Pay capture automation | ● | See CAPTURE; terminal taps only, background Shortcut with retry, AI category from merchant/card. | S3, S6 |
| Automation | Mercado Pago sync | ○ | No service syncs; FAQ rules out direct connections. Android notification reading could capture a payment app's push notifications but that is generic, not a Mercado Pago… | S3 |
| Automation | bank sync (aggregator/open banking) | ○ | FAQ: no direct bank sync (licensing, compliance, unreliable APIs, cost); replaced by Apple Pay, notification, SMS and email automations. | S3 |
| Automation | imports (generic) | ◐ | CSV import accepts only MonAi's own export format; AI-powered any-format import is 'planned'. | S3 |
| Automation | CSV import/export | ● | Export/import from Settings; exports include creator; recurring transactions included since 1.10. | S3, S2 |
| Automation | Excel import/export | ○ | Only CSV is listed; a reviewer asks for PDF export. | S3, S1 |
| Automation | JSON import/export | ○ | Only CSV is listed. | S3 |
| Automation | notification-based automation | ● | Android reads banking/payment push notifications (incl. Google Pay) and logs them, saving ambiguous ones locally for review; iOS instead uses Shortcuts automations trigge… | S3, S6 |
| Automation | recurring detection | ? | Recurrences are set manually; no auto-detection mentioned. | S3 |
| Privacy / Platform | local-first / on-device data | ◐ | iOS: data in the user's own iCloud (CloudKit), no developer server, unless a MonAi Account is created; Android: local storage option. | S4 |
| Privacy / Platform | account required or not | ◐ (● = account required) | No login needed for basic use; MonAi Account (magic-link email) required for AI Reports, WhatsApp, credits and reliable cross-device/shared sync. · 2nd reader: Confirmed. Magic-link login shipped in 1.7.12 (Jan 13), not 1.8.0. Terms explicitly require a MonAi Account for AI Reports; FAQ says both users 'shoul… | S4, S3, S5 |
| Privacy / Platform | cloud sync | ● | MonAi Account sync on Appwrite (Frankfurt, AES at rest, TLS), cross-platform iOS/Android; legacy iCloud sync described as less reliable. | S3, S4 |
| Privacy / Platform | iCloud / CloudKit | ● | CloudKit stores transactions, lists, categories for users who choose iCloud. | S4 |
| Privacy / Platform | Face ID / app lock | ● | FAQ lists Face ID lock as an iOS-specific feature. | S3 |
| Privacy / Platform | hidden amounts (privacy mode) | ? | Not mentioned. | — |
| Privacy / Platform | Apple Watch | ○ | App Store compatibility lists iPhone, Mac and Apple Vision only. · 2nd reader: Confirmed no watchOS entry. Compatibility as shown: iPhone and iPad (iOS/iPadOS 18.0+), Mac (macOS 15.0+, Apple M1 or later), Apple Vision (visionOS 2… | S2 |
| Privacy / Platform | widgets | ● | Home Screen widgets (voice, budget overview, categories, shared lists). | S6 |
| Privacy / Platform | accessibility (VoiceOver, Dynamic Type) evidence | ? | App Store accessibility section: developer has not indicated supported features; dark mode since 1.5.2 is the only related claim. | S2, S6 |
| Privacy / Platform | localization (languages, regions) | ● | Interface and support in English, German, Spanish; AI understands those languages for input; Android app-language setting; prices vary by region. | S2, S3 |
| Privacy / Platform | Android availability | ● | Google Play app.getmonai.android, 50K+ downloads, 4.4 (1.12K reviews), updated Sep 10 2026; lacks AI Reports and Apple-only automations; Play data-safety says no data col… · 2nd reader: Play page read via curl: 50K+ downloads, 1.12K reviews, rating label 4.5 (audit said 4.4), 'Updated on Sep 10, 2026', in-app purchases '$1.99 - $79.99… | S8, S9, S3, S4 |
| Privacy / Platform | web availability | ○ | FAQ and download page offer iOS and Android only; website is marketing/blog. | S3, S10 |
| Monetization | free tier and its limits | ● | Terms: max 20 transactions per month, 1 private + 1 shared list, history limited to the current month. | S4 |
| Monetization | trial | ● | 7-day free trial with all premium features. | S3 |
| Monetization | monthly price | ● | App Store IAPs (USD on both US and AR storefronts): Basic monthly $3.99 (intro $2.99), 'Monthly' $7.99, Student Monthly $2.99, Family $3.99/month (intro $3.99), 'Advanced… | S2, S11, S3 |
| Monetization | annual price | ● | Basic yearly intro $24.99, 'Yearly' $71.99, Student Yearly $24.99 (AR page also lists a $32.49 Student Yearly); some plans are 12-month commitments. | S2, S11, S4 |
| Monetization | lifetime price | ○ | No lifetime item in the in-app purchase list; terms describe subscriptions only. | S2, S4 |
| Monetization | what Pro gates | ● | Paid tiers: unlimited transactions and lists, multiple/shared lists, full history, a monthly AI-credit allowance (AI Reports cost credits; packs purchasable, iOS only); o… | S4, S6 |
| Future Finance | savings goals | ? | Not mentioned. | — |
| Future Finance | investments | ? | Not mentioned; FAQ positions the app as minimalist spending tracking. | S3 |
| Future Finance | net worth | ? | Not mentioned; no accounts exist. | S3 |
| Future Finance | loans / mortgages | ? | Not mentioned. | — |
| Future Finance | assets (property, vehicles) | ? | Not mentioned. | — |
| Organization | move transactions between lists (added) | ● | FAQ: open a transaction and pick a different list on the edit screen. | S3 |
| Privacy / Platform | dark mode (added) | ● | Site changelog v1.5.2: dark mode following the system setting (shipped alongside full Spanish localisation and quarterly recurrence). | S6 |
| Privacy / Platform | iPad compatibility (added) | ● | US listing compatibility block lists iPad (iOS/iPadOS 18.0 or later) in addition to iPhone, Mac (Apple silicon) and Apple Vision. | S2 |
| Monetization | AI credit packs (one-off purchase) (added) | ● | Terms: AI Reports are paid with credits; monthly credits come with a paid subscription; purchased credits are bought as one-off packs; credits and packs are iOS only. | S4, S2 |
| Monetization | Android in-app purchase range (added) | ● | Google Play shows in-app purchases of $1.99 to $79.99 per item (US storefront); individual SKUs not exposed. | S9 |
| Capture | Siri / App Intents (added) | ● | Site changelog v1.1.0: Siri adds expenses without opening the app (iOS 16+, English and German) and the AppIntents appear in the Shortcuts app for custom workflows. | S6 |

Sources:

- S1: https://get-monai.app/
- S2: https://apps.apple.com/us/app/expense-tracker-monai/id6447112647
- S3: https://get-monai.app/faq
- S4: https://get-monai.app/terms.html
- S5: https://apps.apple.com/us/app/expense-tracker-monai/id6447112647?see-all=version-history
- S6: https://get-monai.app/whats-new
- S7: https://get-monai.app/blog/how-to-automate-expense-tracking
- S8: https://play.google.com/store/apps/details?id=app.getmonai.android
- S9: https://play.google.com/store/apps/details?id=app.getmonai.android&hl=en&gl=US
- S10: https://get-monai.app/download
- S11: https://apps.apple.com/ar/app/expense-tracker-monai/id6447112647
- S12: https://get-monai.app/impressum.html
- S13: https://get-monai.app/blog
- S14: https://get-monai.app/sitemap.xml
- S15: https://get-monai.app/blog/apple-wallet-automation-expense-tracking
- S16: https://get-monai.app/blog/how-to-make-apple-pay-automatic
- S17: https://get-monai.app/blog/mobile_expense_app_for_travelers
- S18: https://get-monai.app/blog/ai-powered-expense-tracking-that-sticks
- S19: https://www.producthunt.com/products/monai-2

## Copilot

Product as audited: Copilot: Track & Budget Money (Copilot Money). Official site: https://copilot.money. Second reader's overall confidence: medium.

Could not verify: Argentina App Store listing: all /ar/ URL variants return 404, so no AR price or availability data; treated as…; Monthly Stripe (web) price: pricing page shows only $95/yr ($7.92/mo equivalent) and a monthly option without…; Voice capture, Live Activity/Dynamic Island, Quick Actions, Lock Screen widgets, Shortcuts/App Intents, Siri,…; VoiceOver support: help only addresses display settings; Dynamic Type explicitly unsupported in native apps.; Visual identity hex values and type sizes come from a third-party design write-up, not an official brand page.; Underlying AI model/provider for Money Assistant and whether AI calls are metered: not disclosed.; Help-centre pages were read via a summariser; article wording is paraphrased, not quoted verbatim..

| Group | Capability | Status | What the source says | Sources |
| --- | --- | --- | --- | --- |
| Capture | manual entry | ● | Transactions tab '+' creates a manual transaction with name, amount (expense or refund), date, account, category and type (Regular/Income/Transfer); manual accounts exist… | S1, S2 |
| Capture | voice capture | ? | No mention anywhere in help centre, App Store listing or dispatch. | — |
| Capture | multi-entry voice | ? | No mention. | — |
| Capture | AI categorization | ● | 'Copilot Intelligence': a per-user ML model trained on your own review history (merchant name, amount, weekday, card used); activates after 30 reviewed transactions, appl… | S3, S4 |
| Capture | Apple Pay / Wallet Shortcut capture | ◐ | No Wallet/Shortcut capture. Apple Card/Apple Cash come in via a 'direct integration with Apple' (bank-sync style), not device-side capture. · 2nd reader: Note was wrong about the mechanism. The official article says Apple Card, Apple Cash and Savings are imported from Apple Wallet via FinanceKit, i.e. | S5, S6, S7 |
| Capture | Dynamic Island / Live Activity | ? | Not mentioned in widgets or notifications articles, App Store notes or dispatch. | S8, S9 |
| Capture | WhatsApp / messaging capture | ? | No mention. Closest is Venmo receipt-email forwarding (Labs). | S10 |
| Capture | widgets (Home/Lock Screen) | ◐ | Eight Home Screen widgets: Daily Spending, Spending Category, Budgets (up to 4), Net Worth, Credit Card, Account, Recent Transactions, Transactions To Review. | S8 |
| Capture | Quick Actions (home-screen long-press) | ? | No mention. | — |
| Capture | external integrations / Shortcuts / App Intents | ◐ | No Shortcuts/App Intents documented (a secondary review claims Siri shortcuts; not confirmed by any official source). Official integrations: MCP beta (read-only, tested w… | S11, S12 |
| Organization | categories | ● | Spending categories with budgets, emoji, traffic-light bars; 'Other' cannot be deleted; income and internal transfers cannot be categorised (use tags). | S13 |
| Organization | custom categories | ● | Create and rename categories from the Categories tab. | S14, S13 |
| Organization | tags | ● | Free-form tags on any transaction type (trips, projects, income sources, pending refunds); filter by tag for monthly totals; MCP can reference tags. | S15 |
| Organization | subcategories | ◐ | 'Category groups' (one level): categories become members of a group with an optional unassigned group-level budget; not a deep hierarchy. | S16 |
| Organization | search | ● | Search by merchant name; iOS 8.4.0 adds running totals (spent, income, net) for searched/filtered results. | S17, S18 |
| Organization | filters | ● | Multiple simultaneous filters (category, tag, account, etc.) with totals; filtered export on iPad/Mac/Web; bulk edit. | S17, S19 |
| Organization | merchant intelligence (normalisation, logos, rules) | ● | Exact or partial name-match rules for category/type that apply to past and future transactions (new rule overwrites old); Mac/iPad show 'similar transactions' with monthl… · 2nd reader: Confirmed with a precision: name rules (exact or partial match) assign a category and recategorise matching historic transactions; a new rule for the… | S4, S12, S20 |
| Organization | notes | ◐ (was ●) | Transaction notes exist (exported in CSV 'Notes' column; Venmo note can carry #copilot + category emoji). · 2nd reader: A transaction Notes field exists (CSV export has a Notes column; privacy article says you can download transactional data including categories and not… | S21, S10, S22, S1, S23 |
| Organization | attachments / receipts | ? | No receipt photo/attachment feature documented; only Venmo receipt-email forwarding and Amazon order details. | S1 |
| Spending / Money | accounts | ● | Connected (Plaid primary; Mastercard, MX, Akoya for others; direct Apple, Capital One, Public, Coinbase) and manual accounts; Accounts tab groups Credit Cards, Depository… | S5, S24 |
| Spending / Money | credit cards | ● | Card balances count as debt; credit limit and utilisation colour dots (green <33%, red >90%); card payments are 'Internal Transfer' type so purchases are not double count… | S25, S20 |
| Spending / Money | statement cycles (closing/due dates) | ○ | Help states credit card due-date notifications are not supported; no statement/closing-cycle concept documented. | S9 |
| Spending / Money | installments (cuotas) | ◐ | No instalment-plan object. Workaround: split a transaction across 3, 6 or 12 monthly dated child transactions (web rebuild Jun 11 2026). | S26, S11 |
| Spending / Money | refunds | ◐ | Manual process: categorise the refund like the original and back-date it so the month's category spend nets out; Money Assistant beta suggests refund matches. | S27, S28 |
| Spending / Money | early installment payoff | ○ | No instalment model exists, so nothing to pay off early (feature list omits it). | S26 |
| Spending / Money | recurring expenses | ● | 'Recurrings' created from an existing transaction (needed) or detected at onboarding; weekly, bi-weekly, monthly or non-monthly; filters by name/amount range/date; counte… | S29, S30 |
| Spending / Money | subscriptions | ● | Subscriptions are recurrings: paid vs left-to-pay for the month, less-frequent future ones, archived; list/grid on phone; 'Recurring paid' alert. | S31, S32 |
| Spending / Money | debts / receivables (personal loans) | ◐ | Loan accounts (connected or manual) for money you owe; nothing for personal IOUs/receivables beyond tagging transactions 'awaiting refund'. | S2, S15 |
| Spending / Money | multiple currencies | ○ | USD only; no multi-currency accounts. | S33 |
| Spending / Money | FX semantics | ○ | Foreign transactions arrive already converted to USD by the data provider; original currency and rate are not stored or shown; user may hand-edit the USD amount. | S33 |
| Spending / Money | cash flow view | ● | Cash Flow tab (not on web): income, spending, net; stacked category bars; presets YTD, MTD, last 12 months, last 3 months, last 4 weeks; dotted-line comparison with the p… | S34 |
| Spending / Money | future commitments / upcoming payments | ● | Dashboard 'Upcoming recurrings' list; Recurrings tab shows left-to-pay this month; next expected payment date on each recurring; budgets show expected recurring spend as… | S35, S14 |
| Budgeting / Planning | total budget | ● | Monthly total budget with a 'Free to Spend' figure and ideal-vs-actual spending line; 'rebalance' redistributes the total across categories. | S35, S14 |
| Budgeting / Planning | category budgets | ● | Per-category limits; same budget for all months or month-by-month amounts (12 future months visible); auto-generated from spending history at onboarding. | S36, S37 |
| Budgeting / Planning | goals | ● | Savings Goals as pools funded by allocating account balances; progress colour; 'reactivate when funds dip'; spend from goals via categories; archive (irreversible); none… · 2nd reader: Confirmed and extended: a goal has name, emoji, target amount, optional starting allocation, progress method of either target date or monthly contribu… | S38, S39, S40 |
| Budgeting / Planning | flexible vs fixed budgets / rollover | ● | Rollovers carry remaining (or overspent) balance cumulatively month to month; per-category toggle (turn off for fixed bills); global toggle; 'first month with a rollover'… | S41, S30 |
| Budgeting / Planning | pay-cycle periods (custom month start / salary cycles) | ? | Everything is calendar-month based; no setting for a custom month start found in Settings Overview or budgets articles, but no explicit statement of absence. | S32, S36 |
| Budgeting / Planning | calendar view | ? | No calendar view documented (only a date picker when editing splits). | S26 |
| Budgeting / Planning | projections / forecasts | ◐ | Expected recurring spend is pre-counted in budgets and the spending line shows an ideal pace; Live Balance Estimates project investment balances intraday. | S34, S42 |
| Budgeting / Planning | reminders | ◐ | Alerts for low balance (<$100), credit utilisation 30/60/90%, big expense (>$500), bank fee, recurring paid, income, weekly Monday spending comparison, Venmo. | S9, S32 |
| Reporting | by category | ● | Categories tab ranks categories by spend vs budget; tapping the chart gives yearly totals and monthly averages. | S14 |
| Reporting | daily | ◐ | Daily Spending widget and the day-by-day spending line; no dedicated daily report. | S8, S35 |
| Reporting | trends over time | ● | Category history charts from the first transaction, cash-flow period charts, net-worth timeline, Month/Year in Review 'related trends'. | S36, S43 |
| Reporting | period comparisons | ● | Cash Flow overlays the previous equal period; Dashboard 'Net This Month' vs last month; weekly spending vs previous week alert. | S34, S35 |
| Reporting | by merchant | ◐ | Search a merchant for running totals; Mac/iPad show similar-name transactions with monthly totals; Money Assistant chat can draw merchant comparison charts. · 2nd reader: Note overstated: the dispatch says the Money Assistant beta gives proactive suggestions with inline charts; it does not say it draws merchant comparis… | S17, S11, S18 |
| Reporting | subscriptions report | ◐ (was ●) | Recurrings tab totals expected monthly recurring spend, paid vs remaining. · 2nd reader: The Recurrings tab article confirms paid vs left-to-pay for the month, less-frequent future recurrings, archived, list/grid (list only on Mac/iPad). | S31, S44 |
| Reporting | calendar report | ? | Not documented. | — |
| Reporting | custom date ranges | ◐ | Cash Flow offers five presets only; transactions can be filtered; net-worth graph timeframe selectable. No arbitrary from/to range documented. | S34, S24 |
| Reporting | AI-generated reports | ◐ | Month in Review and Year in Review slide reports (shareable) are templated, not stated as AI; Money Assistant beta gives daily briefings and in-chat charts. | S43, S28 |
| Reporting | explain / query financial data in natural language | ◐ (was ●) | Money Assistant beta (Apr 16 2026): natural-language questions with full ledger context, charts in chat, proactive suggestions, edits only after approval; MCP beta (May 1… · 2nd reader: Both features are beta behind a waitlist: the Money Assistant post (Apr 16 2026) says join the waitlist and points to agent.copilot.money (a web page,… | S28, S11, S45, S4, S46 |
| Collaboration | split expenses | ○ | 'Splitting' divides one transaction into child transactions across categories or months for the same user; no cost-sharing with people. | S26 |
| Collaboration | equal split | ○ | Equal mode exists only for dividing a transaction into 3/4/5 parts or 3/6/12 months within one ledger, not among people. | S26 |
| Collaboration | percentage split | ○ | Percentage mode exists on web for category splits only. | S26 |
| Collaboration | share-based split | ○ | Not offered. | S26 |
| Collaboration | exact-amount split | ○ | Custom dollar amounts exist for category splits only; children must sum to the parent. | S26 |
| Collaboration | groups | ○ | No expense groups; shared rent is modelled as a full recurring plus a negative 'credit' recurring. | S44 |
| Collaboration | invitations / participants without accounts | ○ | No participant concept. | S47 |
| Collaboration | household / partner shared finances | ◐ | Share the single account by forwarding a magic-link login; the partner gets full control, no separate profiles or permissions; suggested tags/category groups per person. | S47 |
| Collaboration | debt simplification | ○ | No multi-person debt tracking at all. | S44 |
| Automation | Apple Pay capture automation | ◐ (was ○) | Apple Card/Cash sync via Apple direct integration only; no on-device Apple Pay capture. · 2nd reader: FinanceKit import is automatic on-device capture of Apple Card/Apple Cash/Savings activity (which covers Apple Pay purchases made on Apple Card) with… | S5, S6 |
| Automation | Mercado Pago sync | ○ | US institutions only; aggregators are Plaid, Mastercard, MX, Akoya. | S33, S5 |
| Automation | bank sync (aggregator/open banking) | ● | Plaid for most US institutions; Mastercard (Finicity), MX and Akoya as fallbacks; direct Apple, Capital One, Public, Coinbase; crypto wallets/exchanges (Binance.US API). · 2nd reader: Confirmed; crypto detail corrected. Official crypto article: exchanges Binance.US, Bitstamp, Coinbase (OAuth, crypto only), FTX US (stale), Gemini, Kr… | S5, S37, S48, S49, S33 |
| Automation | imports (generic) | ○ | No transaction or balance-history import; help states historic data points cannot be created or imported. | S2 |
| Automation | CSV import/export | ◐ | Export yes: full CSV (date, name, amount, status, category/parent, excluded, type, account/mask, notes, recurrings) from Settings on all platforms, filtered export on iPa… | S21, S50 |
| Automation | Excel import/export | ○ | Export is CSV only; XLS import for investments explicitly unsupported. | S21 |
| Automation | JSON import/export | ○ | CSV is the only export format listed. | S21 |
| Automation | notification-based automation (reading bank/payment notifications) | ◐ | Email-based: Venmo receipt emails forwarded to a per-user address create transactions in real time and mark bank transfers to/from Venmo as internal; no reading of device… | S10 |
| Automation | recurring detection | ● | Likely recurrings detected at onboarding for review; frequency auto-estimated when creating one; transactions auto-link to recurrings by name/amount/date filters. | S37, S29 |
| Privacy / Platform | local-first / on-device data | ○ | Cloud-first: data lives on Google Cloud backend, device holds a cache that can be cleared and re-downloaded; Apple article notes a local store for responsiveness. · 2nd reader: Confirmed cloud-first (Google Cloud backend; local cache clearable from Settings > Advanced). Apple's developer article says data is kept locally for… | S51, S5, S52 |
| Privacy / Platform | account required or not | ● (● = account required) | Account required (Sign in with Apple or email magic link; password sign-in temporarily restricted); subscription chosen at onboarding to start the trial. | S53, S37 |
| Privacy / Platform | cloud sync | ● | Same account on iPhone, iPad, Mac and Web; multiple devices simultaneously. | S54, S55 |
| Privacy / Platform | iCloud / CloudKit | ○ | Backend is Google Cloud, not iCloud. | S5 |
| Privacy / Platform | Face ID / app lock | ● | 'Require Face ID' toggle in Settings; 2FA available (2026); enabling Face ID hides widgets on iOS 18. · 2nd reader: Confirmed. 'Require Face ID' toggle in Settings; iOS 18 hides widgets when it is on. 2FA confirmed by a dedicated article (authenticator apps Authy/Go… | S32, S8, S56, S57 |
| Privacy / Platform | hidden amounts (privacy mode) | ? | Not listed in Settings Overview. | S32 |
| Privacy / Platform | Apple Watch | ○ | App Store compatibility lists iPhone, iPad, Mac and Apple Vision only; no Watch in help Platforms collection. | S18, S58 |
| Privacy / Platform | widgets | ● | Eight iOS Home Screen widgets (see Capture). | S8 |
| Privacy / Platform | accessibility (VoiceOver, Dynamic Type) evidence | ◐ | Help says Dynamic Type is not supported in the native Apple apps (planned); offers 'Accessible Colors', +/- display for amounts, dark mode; VoiceOver not documented. | S59 |
| Privacy / Platform | localization (languages, regions) | ○ | English only on the App Store; US only; USD only. | S18, S33 |
| Privacy / Platform | Android availability | ○ | Official statements list iPhone, iPad, Mac and Web only; no Android. | S55, S60 |
| Privacy / Platform | web availability | ● | Web app since Dec 2025 (app.copilot.money), desktop-optimised; missing Goals, Cash Flow, name rules, real estate, Venmo/Amazon setup, review summaries. · 2nd reader: Confirmed (app.copilot.money, Dec 2025, desktop-optimised). Missing-on-web list per the Web FAQ is longer than noted: Goals, Cash Flow, demo mode, tra… | S55, S19 |
| Monetization | free tier and its limits | ○ | No free tier: subscription required after the trial; pricing page has a 'Why isn't Copilot free?' section. Referral codes add free months. · 2nd reader: No free tier confirmed (trial then subscription). However the pricing page section headings the researcher read are 'Honest and thoughtful pricing' an… | S61, S37 |
| Monetization | trial | ● | 1-month free trial, auto-renewing, chosen (annual or monthly) at onboarding; gift/referral codes extend it. | S60, S37 |
| Monetization | monthly price | ● | US App Store IAP 'Monthly subscription' USD 13.00; Stripe path on web/Mac site exists (amount not shown on pricing page). | S18, S62 |
| Monetization | annual price | ● | USD 95.00/year (App Store IAP 'Yearly subscription'; pricing page shows $95/yr = $7.92/mo). | S18, S61 |
| Monetization | lifetime price | ○ | Not offered on pricing page or IAP list. | S61, S18 |
| Monetization | what Pro gates (the meaningful boundary) | ● | Single plan gates the whole product; the subscription covers iPhone, iPad, Mac and Web. AI features (Money Assistant, MCP) are beta/waitlist within the subscription. | S19, S28 |
| Future Finance | savings goals | ● | See Goals above. | S38 |
| Future Finance | investments | ● | Holdings, ~15-min delayed prices, performance excluding transfers, allocation by security type, BTC/ETH benchmarks, crypto wallets/exchanges, manual holdings, Live Balanc… | S63 |
| Future Finance | net worth | ● | Net worth graph with selectable timeframe, combined or assets-vs-debts lines; Net Worth widget. | S24 |
| Future Finance | loans / mortgages | ● | Loan accounts (connected or manual) counted as debt; mortgages link to properties for home equity (needs origination date and original amount). | S64, S2 |
| Future Finance | assets (property, vehicles) | ● | Real estate via Zillow Zestimate (monthly, with history) or RentCast (low/mid/high) or manual; cars and other physical assets as manual cash accounts with hand-updated va… | S64, S65 |
| Budgeting / Planning | optional budgeting (budgets can be switched off) (added) | ● | Settings > Features toggle disables budgeting entirely; dashboard and categories then compare this month to last month with a dotted even-pace line, rebalance disappears,… | S66 |
| Organization | excluded transactions / excluded categories (business vs personal) (added) | ● | Transactions and whole categories can be marked excluded so they do not count toward monthly spending or budgets while remaining tracked (recommended for business, renova… | S67, S68, S21 |
| Privacy / Platform | two-factor authentication (added) | ● | 2FA via authenticator apps (Authy, Google Authenticator, Cisco Duo); article updated Jan 28 2026; iOS 7.2.1 (Mar 27) release note mentions improved 2FA error messaging. | S56, S69 |
| Organization | bulk editing (added) | ● | Multi-select on iOS (long-press), Mac/iPad (checkbox); bulk mark reviewed and change category (other fields depend on selection state); keyboard shortcuts X, R, C, F, Cmd… | S70, S19 |
| Spending / Money | hide / close accounts (added) | ● | Hiding moves an account to a Hidden Accounts section (still syncs, still in net worth, reversible); marking closed disconnects it permanently and keeps history. | S71 |
| Future Finance | crypto wallets and exchanges (added) | ● | Exchange API-key links (Binance.US, Bitstamp, Gemini, Kraken; Coinbase via OAuth, crypto only; FTX US still listed), BTC/ETH public addresses with ERC-20 tokens, BTC xPub… | S48, S49 |
| Organization | custom emoji (Genmoji) for categories and recurrings (added) | ● | Generate Genmoji from the emoji search in category and recurring detail views; needs iOS/iPadOS 18.2 or macOS 15.2 and iPhone 15 Pro or later to create; shows '?' on olde… | S72 |
| Privacy / Platform | demo mode (added) | ● | Settings offers a demo mode with sample data on the native apps; the Web FAQ lists demo mode as not available on web. | S32, S19 |
| Privacy / Platform | Mac distribution (Mac App Store and direct download) (added) | ● | Mac app available from the Mac App Store (listing: macOS 14+, version 6.5.0 Sep 21) and as a direct download from copilot.money/download (page says macOS 12 Monterey+, Ap… | S73, S57, S54, S74, S62 |
| Monetization | referral free months and gift codes (added) | ● | Dashboard 'Free Months' tracker with a shareable referral code; referral or gift codes can be entered at the subscription step; gift code purchase from Settings. | S35, S37, S32 |
| Monetization | refund policy (added) | ● | App Store purchases: refund requests go to Apple. Stripe purchases: full refund if cancelled within one month of purchase and requested within five days of cancelling. | S62 |
| Automation | historical transaction import on connection (added) | ◐ | On connecting an institution most provide one to two years of transaction history (some less); investment history cannot be backfilled. | S75, S50 |
| Organization | category archiving (added) | ◐ | The Web FAQ lists 'category archiving' as a native feature missing on web, implying an archive action exists in the native apps; the tips article instead describes a manu… | S19, S68 |
| Privacy / Platform | keyboard shortcuts and iPad multitasking (added) | ● | Mac: Cmd+1..8 tab switching plus transaction shortcuts; iPad gets all Mac shortcuts with a keyboard, split view / slide over / centre window; web has transaction shortcut… | S54, S7, S19 |

Sources:

- S1: https://help.copilot.money/en/articles/4038706-creating-manual-transactions
- S2: https://help.copilot.money/en/articles/10682991-understanding-manual-accounts
- S3: https://help.copilot.money/en/articles/8182433-copilot-intelligence-for-spending
- S4: https://help.copilot.money/en/articles/3971270-transaction-name-rules-for-categorization
- S5: https://help.copilot.money/en/articles/10768078-how-do-you-get-my-financial-data
- S6: https://help.copilot.money/en/articles/9038131-apple-card-apple-cash-and-savings
- S7: https://help.copilot.money/en/articles/10003978-copilot-money-for-ipad
- S8: https://help.copilot.money/en/articles/9834331-adding-widgets
- S9: https://help.copilot.money/en/articles/10671399-notifications
- S10: https://help.copilot.money/en/articles/3971255-venmo-integration-faq
- S11: https://www.copilot.money/dispatch
- S12: https://help.copilot.money/en/articles/5569639-amazon-integration
- S13: https://help.copilot.money/en/articles/10216528-categories-faq
- S14: https://help.copilot.money/en/articles/9504513-categories-tab-overview
- S15: https://help.copilot.money/en/articles/9554370-creative-ways-to-use-tags
- S16: https://help.copilot.money/en/articles/3767655-groups-of-categories
- S17: https://help.copilot.money/en/articles/9554412-transactions-tab-overview
- S18: https://apps.apple.com/us/app/copilot-track-budget-money/id1447330651
- S19: https://help.copilot.money/en/articles/13157382-web-faq
- S20: https://help.copilot.money/en/articles/3971267-transaction-types
- S21: https://help.copilot.money/en/articles/5944414-exporting-your-transaction-data
- S22: https://help.copilot.money/en/articles/9981768-privacy-and-security
- S23: https://help.copilot.money/en/?q=notes
- S24: https://help.copilot.money/en/articles/6213732-accounts-tab-overview
- S25: https://help.copilot.money/en/articles/10310069-credit-utilization
- S26: https://help.copilot.money/en/articles/5325255-splitting-transactions
- S27: https://help.copilot.money/en/articles/5325170-refund-and-reimbursement-transactions
- S28: https://www.copilot.money/dispatch/beta-introducing-your-money-assistant
- S29: https://help.copilot.money/en/articles/3760068-creating-recurrings
- S30: https://help.copilot.money/en/articles/10244751-recurrings-faq
- S31: https://help.copilot.money/en/articles/9778259-recurrings-tab-overview
- S32: https://help.copilot.money/en/articles/11062072-settings-overview
- S33: https://help.copilot.money/en/articles/10715424-international-currency
- S34: https://help.copilot.money/en/articles/9682232-cash-flow-tab-overview
- S35: https://help.copilot.money/en/articles/6045480-dashboard-tab-overview
- S36: https://help.copilot.money/en/articles/6206293-editing-budgets-by-month
- S37: https://help.copilot.money/en/articles/11157550-quick-start-guide
- S38: https://help.copilot.money/en/articles/11139571-goals-faq
- S39: https://help.copilot.money/en/articles/11100462-creating-new-goals
- S40: https://help.copilot.money/en/articles/11100511-spending-from-savings-goals
- S41: https://help.copilot.money/en/articles/3790828-budget-rollovers
- S42: https://help.copilot.money/en/articles/5497913-live-balance-estimates
- S43: https://help.copilot.money/en/articles/10310024-month-and-year-in-review
- S44: https://help.copilot.money/en/articles/5324776-shared-recurring-expenses
- S45: https://www.copilot.money/dispatch/mcp
- S46: https://help.copilot.money/en/?q=MCP
- S47: https://help.copilot.money/en/articles/4523792-sharing-your-account-with-a-partner
- S48: https://help.copilot.money/en/articles/6162313-crypto-support-with-copilot
- S49: https://help.copilot.money/en/articles/5961560-adding-cryptocurrency-addresses
- S50: https://help.copilot.money/en/articles/10262766-investment-account-limitations
- S51: https://help.copilot.money/en/articles/9922978-clearing-local-cache-in-copilot
- S52: https://developer.apple.com/articles/copilot-money/
- S53: https://help.copilot.money/en/articles/9829510-logging-into-copilot
- S54: https://help.copilot.money/en/articles/6778561-copilot-money-for-macos
- S55: https://help.copilot.money/en/articles/11780342-copilot-money-for-web
- S56: https://help.copilot.money/en/articles/13264550-using-2fa-with-copilot-money
- S57: https://help.copilot.money/en/articles/11011483-mac-faq
- S58: https://help.copilot.money/en/collections/3738578-platforms
- S59: https://help.copilot.money/en/articles/9828946-display-settings-for-vision
- S60: https://www.copilot.money/sign-up
- S61: https://copilot.money/pricing
- S62: https://help.copilot.money/en/articles/6860727-managing-your-copilot-subscription
- S63: https://help.copilot.money/en/articles/5377645-investments-tab-overview
- S64: https://help.copilot.money/en/articles/8047816-real-estate-accounts
- S65: https://help.copilot.money/en/articles/10760871-tracking-your-car-and-other-physical-assets
- S66: https://help.copilot.money/en/articles/6282850-optional-budgeting
- S67: https://help.copilot.money/en/?q=excluded
- S68: https://help.copilot.money/en/articles/10684301-category-tips-tricks
- S69: https://apps.apple.com/us/app/copilot-track-budget-money/id1447330651?see-all=version-history
- S70: https://help.copilot.money/en/articles/7668990-bulk-editing-transactions
- S71: https://help.copilot.money/en/articles/5031610-hiding-and-closing-accounts
- S72: https://help.copilot.money/en/articles/10269668-genmojis-in-copilot
- S73: https://copilot.money/download
- S74: https://apps.apple.com/us/app/copilot-track-budget-money/id1447330651?platform=mac
- S75: https://help.copilot.money/en/?q=historical%20transaction%20data
- S76: https://apps.apple.com/ar/app/copilot-track-budget-money/id1447330651
- S77: https://apps.apple.com/ar/app/id1447330651
- S78: https://apps.apple.com/ar/app/copilot-track-budget-money/id1447330651?l=es
- S79: https://copilot.money
- S80: https://copilot.money/privacy-policy/
- S81: https://help.copilot.money
- S82: https://help.copilot.money/en/
- S83: https://help.copilot.money/en/collections/12265868-getting-started
- S84: https://help.copilot.money/en/collections/12296785-copilot-account
- S85: https://help.copilot.money/en/collections/3377753-copilot-labs
- S86: https://help.copilot.money/en/collections/10367164-accessibility
- S87: https://help.copilot.money/en/collections/2199953-recurrings
- S88: https://help.copilot.money/en/collections/12508175-goals
- S89: https://help.copilot.money/en/collections/10261166-cash-flow
- S90: https://help.copilot.money/en/collections/3136877-investments
- S91: https://help.copilot.money/en/articles/4537532-creating-manual-accounts
- S92: https://help.copilot.money/en/articles/10684135-account-management-faq

## Monarch

Product as audited: Monarch (App Store name: "Monarch: Budget & Track Money"; company Monarch Money, Inc.). Official site: https://www.monarch.com/. Second reader's overall confidence: high.

Could not verify: Argentina App Store listing: /ar/ URL returns HTTP 404 and iTunes lookup country=ar returns zero results, so t…; Face ID / biometric app lock: no help article found either way; only MFA for login is documented.; Voice capture, Live Activities, Quick Actions, Siri Shortcuts / App Intents: no documentation found; treated a…; Accessibility (VoiceOver, Dynamic Type): App Store says the developer has not declared accessibility features.; Plus monthly price: the App Store IAP list shows no monthly Plus item and the pricing page only shows Plus bil…; Merchant logos: normalisation and rules are documented, logos are not explicitly mentioned.; Exact version-history dates for 2.0.117 and earlier come from the App Store page's relative labels ('4d ago',…; https://www.monarch.com/features and https://www.monarch.com/features/couples returned 404; help.monarch.com b….

| Group | Capability | Status | What the source says | Sources |
| --- | --- | --- | --- | --- |
| Capture | manual entry | ● | Add transaction on web or mobile (debit/credit, amount, merchant, date, account, category, note, tags); manual accounts can adjust balance. | S1 |
| Capture | voice capture | ? | No help article or feature page mentions voice entry; help-centre search for 'voice' returns nothing. Not claimed anywhere read. | S2 |
| Capture | multi-entry voice (several movements in one utterance) | ? | No evidence of any voice capture at all. | — |
| Capture | AI categorization | ● | Transactions are auto-categorised on arrival using AI (third-party LLMs plus in-house models); 'enhanced categorization and transaction details' listed as an AI use. | S3, S4 |
| Capture | Apple Pay / Wallet Shortcut capture | ◐ | Not a Wallet capture flow: instead Apple Card, Apple Cash and Apple Savings sync as accounts via the iPhone app (FinanceKit-style access, background refresh requires noti… | S5 |
| Capture | Dynamic Island / Live Activity | ? | No mention in help centre, release notes or product updates; search for 'Live Activity' returns unrelated articles. | S6 |
| Capture | WhatsApp / messaging capture | ○ | Only capture channels documented are manual entry, bank sync, CSV import, receipt scan/upload and email forwarding of receipts (receipts@my.monarch.com). | S7, S8 |
| Capture | widgets (Home/Lock Screen) | ◐ | iOS and Android Home Screen widgets: Budget ring (per category/group, amounts can be hidden), Transactions list (3 or 8 items; needs review / recent / uncategorised), Inv… | S9 |
| Capture | Quick Actions (home-screen long-press) | ◐ (was ?) | Not documented anywhere read. · 2nd reader: App Store version history (2.0.91) lists a Quick Action for receipt scanning; the receipts help article says you can long-tap the Monarch app icon to… | S10, S7 |
| Capture | external integrations / Shortcuts / App Intents | ◐ | No Siri Shortcuts / App Intents. Integrations are: Chrome Retail Sync extension (Amazon US, Target: auto-split and categorise orders), Zillow (home value), VinAudit (vehi… · 2nd reader: The note's claim 'No Siri Shortcuts / App Intents' is wrong. App Store version history 2.0.91 (Apr 15 2026) says a home screen widget, Siri Shortcut a… | S11, S12, S13, S10, S7, S14 |
| Organization | categories | ● | Exhaustive default category list organised in Income / Expense / Transfer groups; defaults carry a permanent internal ID used for auto-categorisation. | S15 |
| Organization | custom categories | ● | Create custom categories (icon/emoji, name, group, rollover flag, exclude-from-budget flag) and custom groups on web and mobile; reorder. | S15 |
| Organization | tags | ● | Many tags per transaction, custom colour/name; defaults Tax, Reimburse, Split, Business, Subscription; member-name tags auto-created; bulk tagging. | S16 |
| Organization | subcategories | ◐ | Two levels only: category groups containing categories (group-level budgeting optional). No deeper nesting. · 2nd reader: Confirmed two-level model (groups containing categories). Categories article read; no deeper nesting documented. | S15 |
| Organization | search | ● | Search any transaction across all accounts; notes are searchable; web CommandK searches categories, merchants, accounts, goals, saved reports. | S10, S12 |
| Organization | filters | ● | Filter by date range, accounts, categories, merchants, goals, ownership, business entity, amount, tags, needs-review status; filters persist into detail pages. | S17, S18 |
| Organization | merchant intelligence (normalisation, logos, rules) | ● | Merchant names normalised from the original statement; rules match on original statement, merchant, amount etc. and can rename merchant, recategorise, tag, set owner, hid… · 2nd reader: Status confirmed, note corrected: logos ARE documented. Tips & Tricks says custom images/logos can be uploaded for merchants and accounts (edit mercha… | S19, S20 |
| Organization | notes | ● | Free-text notes per transaction (searchable, exportable); account-level Notes card added in 2.0.116/2.0.118. | S21 |
| Organization | attachments / receipts | ● | Up to 3 images per transaction (PDF on web only); receipt scanning/upload and email forwarding use AI to extract merchant/amount/date, auto-match (amount, date window, me… | S21, S7 |
| Spending / Money | accounts | ● | Synced accounts via Plaid, Finicity (Mastercard) and MX (13,000+ institutions, US/Canada) plus manual accounts, Zillow property, VinAudit vehicles, crypto/Coinbase, manua… | S22, S23 |
| Spending / Money | credit cards | ● | Credit cards are liability accounts; the purchase is the expense, the payment is a 'Credit Card Payment' transfer excluded from spending (explicit no-double-count model). | S24 |
| Spending / Money | statement cycles (closing/due dates) | ◐ | Bill Sync pulls statement balance, minimum payment and due date for cards and loans daily via Spinwheel (Equifax credit report, soft pull); US only, web setup required, n… | S25, S26 |
| Spending / Money | installments (cuotas) | ○ | No instalment-plan concept; Apple Card Monthly Installments only appear as part of the synced Total Balance. Nothing in help or feature pages models purchase instalments. | S5 |
| Spending / Money | refunds | ◐ | Refunds arrive as credit transactions (searchable 'charges or refunds'); treemap shows refunds distinctly. No dedicated refund-linking workflow documented. | S10, S27 |
| Spending / Money | early installment payoff | ○ | No instalment feature exists, so no early payoff. | S25 |
| Spending / Money | recurring expenses | ● | Recurring page with calendar and list; auto-detects recurring merchants on every sync; manual recurring merchants with frequencies (incl. | S28 |
| Spending / Money | subscriptions | ● | Subscriptions tracked as recurring items with a 'Subscription' default tag; AI assistant can list all current subscriptions; weekly recap flags subscription changes. | S4, S16 |
| Spending / Money | debts / receivables (personal loans) | ◐ | Loans as liability accounts (synced or manual) with Pay Down goals; a 'Reimburse' tag exists. No person-to-person IOU / receivable ledger. | S29, S16 |
| Spending / Money | multiple currencies | ○ | Single-currency app: everything shown with '$'; no distinction between USD and CAD behind the scenes, no conversion; mixing currencies produces misleading totals; no plan… | S30 |
| Spending / Money | FX semantics | ○ | No original currency stored, no rate source: a 1,000 JPY transaction appears as '$1,000'. Subscription refunds for Canadians are in USD at the bank's rate. | S30 |
| Spending / Money | cash flow view | ● | Cash Flow tab in Reports (and standalone page): Sankey (web, now mobile too), stacked trend bars, income / spending / net cash flow / savings rate summary, daily to yearl… | S17, S31 |
| Spending / Money | future commitments / upcoming payments | ● | Recurring 'Upcoming' calendar on mobile, dashboard upcoming-expenses widget, bill due dates from Bill Sync, weekly recap of upcoming expenses. | S28 |
| Budgeting / Planning | total budget | ● | Monthly cash-flow budget: expected income minus planned expenses and savings, with 'left to budget' balance; Flex budgeting tracks one flexible number. | S32 |
| Budgeting / Planning | category budgets | ● | Category budgeting assigns every expense category a budget; group-level budgeting optional; defaults auto-filled from 6-month averages; overspend alerts. | S32, S13 |
| Budgeting / Planning | goals | ● | Goals 3.0 (out of beta July 2026): Save Up goals with target, date, monthly contribution, on-track status, fund allocations, growth rates; Pay Down goals per liability wi… | S33, S29 |
| Budgeting / Planning | flexible vs fixed budgets / rollover | ● | Flex budgeting buckets Fixed / Non-monthly / Flex; per-category rollovers for expense categories (formula rollover + planned - actual), rollover funds for seasonal spend. | S34, S35 |
| Budgeting / Planning | pay-cycle periods (custom month start / salary cycles) | ○ | Budget is explicitly a calendar-monthly cash-flow system; help search for pay period / weekly budget returns nothing relevant and no setting is documented. | S32 |
| Budgeting / Planning | calendar view | ● | Recurring calendar (web monthly calendar/list; mobile calendar with list). · 2nd reader: Confirmed (recurring calendar on web and mobile). Additionally a web-only Budget Calendar View shows 12 months of budgets in a grid with month/year/de… | S28, S36 |
| Budgeting / Planning | projections / forecasts | ◐ | Full Forecasting (net worth and cash flow projections, life events, retirement, scenario comparison, variable growth rates) is Plus-only; Core gets goal on-track projecti… | S37, S38 |
| Budgeting / Planning | reminders | ● | Push and email notifications for recurring/bills, overspend alerts, customisable in Settings > Notifications. | S28, S13 |
| Reporting | by category | ● | Spending and Income tabs grouped by category, group or merchant with pie, breakdown bars, trend bars, treemap. | S17 |
| Reporting | daily | ● | Cash Flow timeframe from daily to yearly; detail pages support daily/weekly/monthly/quarterly/yearly/all-time. | S17 |
| Reporting | trends over time | ● | Trend Bars (stacked or grouped), month-over-month merchant/category trends, spending trend dashboard widget. | S17 |
| Reporting | period comparisons | ◐ | Trend bars across periods and AI questions like 'compare to last month'; monthly review shows last-4-months trends. No explicit side-by-side period comparison control doc… | S39, S4 |
| Reporting | by merchant | ● | Group Spending/Income by merchant; merchant detail pages. | S17 |
| Reporting | subscriptions report | ◐ | Recurring 'All recurring' list (active / cancelled) and AI subscription listing; no dedicated subscriptions report chart. | S28 |
| Reporting | calendar report | ◐ | Recurring calendar only; no spending-by-day calendar heat map documented. | S28 |
| Reporting | custom date ranges | ● | Date-range filter on Reports (web and mobile); saved reports keep timeframe. | S17 |
| Reporting | AI-generated reports | ● | AI Insights (sparkle icon) explain what changed on dashboard/accounts; Weekly Recap summary; mobile Monthly Progress Report walkthrough; CommandK can generate reports. | S4, S39 |
| Reporting | explain / query financial data in natural language | ● | AI Assistant answers questions over the user's actual ledger (spending patterns, cash flow, net worth changes, subscriptions, benchmarks) and app how-to; optional househo… | S4, S3 |
| Collaboration | split expenses | ◐ | 'Split transaction' divides one transaction into category parts (manually or by rule, by % or amount); it is a categorisation split, not a cost-sharing split between peop… | S40, S19 |
| Collaboration | equal split | ○ | No shared-cost splitting between people; only category splits. | S40 |
| Collaboration | percentage split | ◐ | Rules can split a transaction by percentage into categories, not between people. | S19 |
| Collaboration | share-based split | ○ | Not offered. | S40 |
| Collaboration | exact-amount split | ◐ | Dollar-amount category splits only. | S19 |
| Collaboration | groups | ○ | Only the household (and optional professional) exists; no friend groups or trips. Help search for Splitwise returns nothing. | S41 |
| Collaboration | invitations / participants without accounts | ○ | Household members must create their own Monarch login via the invite link (and cannot already own another Monarch account). | S41 |
| Collaboration | household / partner shared finances | ● | Unlimited household members under one subscription at no extra cost; roles Admin / Member / Professional; one shared dashboard and budget; Shared Views assign owner (Shar… | S41, S42 |
| Collaboration | debt simplification | ○ | No settle-up or balances between people. | S42 |
| Automation | Apple Pay capture automation | ◐ | Apple Card / Cash / Savings background sync on iPhone (needs Background App Refresh and notifications on); not Apple Pay capture for other cards. | S5 |
| Automation | Mercado Pago sync | ○ | Not available: the app is US/Canada only and connects through Plaid, Finicity and MX; Argentina storefront returns 404. | S43, S44 |
| Automation | bank sync (aggregator/open banking) | ● | Plaid, Finicity (Mastercard) and MX, OAuth where the bank supports it, read-only; 13,000+ institutions in the US and Canada; per-institution public connection status dash… | S22, S27 |
| Automation | imports (generic) | ● | CSV transaction and balance-history import (web only), keyword column mapping, overlap handling (prioritise CSV / Monarch / import all / match by transaction ID); receipt… | S45 |
| Automation | CSV import/export | ● | Import on web; export per account, all accounts (Settings > Data), balance history, filtered report transactions and charts as PNG; export available even after the subscr… | S46 |
| Automation | Excel import/export | ○ | Only CSV is documented for import and export. | S45 |
| Automation | JSON import/export | ○ | Only CSV is documented. | S46 |
| Automation | notification-based automation (reading bank/payment notifications) | ○ | Data comes from aggregators, Apple Card API, CSV, receipts; no notification-reading capture documented. | S47 |
| Automation | recurring detection | ● | Every sync scans new transactions to detect recurring merchants; 'Find recurring merchants' re-scan; Bill Sync for card/loan statements. | S28 |
| Privacy / Platform | local-first / on-device data | ○ | Cloud service: data stored in US AWS data centres, encrypted at rest and in transit, SOC 2 Type 2. | S48 |
| Privacy / Platform | account required or not | ● (● = account required) | Account required (email, Apple or Google sign-in) with paid subscription after a 7-day trial; payment method required to start the trial. | S13, S49 |
| Privacy / Platform | cloud sync | ● | Same data on web, iOS, Android and iPad through Monarch's servers. | S50 |
| Privacy / Platform | iCloud / CloudKit | ○ | Proprietary cloud, not iCloud. | S48 |
| Privacy / Platform | Face ID / app lock | ? | Help centre documents multi-factor authentication for the login but no biometric app lock article was found (search 'Face ID' / 'biometric' returns nothing relevant). · 2nd reader: Re-checked: help-centre search API for 'Face ID', 'biometric', 'passcode', 'app lock' returns no biometric-lock article (only MFA and login OTP email)… | S51, S52, S53, S54, S10 |
| Privacy / Platform | hidden amounts (privacy mode) | ◐ | Budget widget can hide dollar amounts (ring only); accounts can be hidden from lists/net worth; Demo Mode exists. No global amount-blur mode documented. · 2nd reader: Confirmed and strengthened: Demo Mode (mobile only, app 2.0.77+) masks all balances, net worth, transactions and charts on Dashboard, Accounts, Transa… | S9, S55, S56 |
| Privacy / Platform | Apple Watch | ○ | App Store listing is iPhone/iPad (and Vision) only; download page and help centre have no Watch app. | S10, S50 |
| Privacy / Platform | widgets | ● | Budget, Transactions, Investments and Receipt Scanning Home Screen widgets on iOS and Android; stackable. | S9 |
| Privacy / Platform | accessibility (VoiceOver, Dynamic Type) evidence | ? | App Store Accessibility section: developer has not yet indicated supported accessibility features. Dark/light mode persistence documented. | S10 |
| Privacy / Platform | localization (languages, regions) | ◐ | English only; regions US and Canada; '$' symbol only; US date formats in CSV import. | S10, S43 |
| Privacy / Platform | Android availability | ● | Google Play 'Monarch: Budget & Track Money' by Monarch Money, 4.8 stars, 25.5K reviews, 500K+ downloads, updated Sep 29, 2026, in-app purchases. | S57 |
| Privacy / Platform | web availability | ● | Full web app at app.monarch.com; several features (CSV import, Bill Sync setup, saved-report creation, Chrome extension) are web-only. | S50, S45 |
| Monetization | free tier and its limits | ○ | No free tier: 'we only offer paid subscriptions'; data export remains available after the subscription ends. | S58 |
| Monetization | trial | ● | 7-day free trial on Core and Plus, payment method required, cancel 24 h before end; money-back guarantee after subscribing; promo WELCOME 30% off first annual Core year (… | S13, S43 |
| Monetization | monthly price | ● | US App Store in-app purchase 'Monthly Subscription' USD 14.99 (Core). Plus monthly not listed on the App Store; pricing page shows Plus only as $16.67/mo billed annually. · 2nd reader: Confirmed App Store IAP 'Monthly Subscription' USD 14.99. Plus has no monthly option at all: the Plus help hub states Plus is billed annually, and the… | S10, S13, S38 |
| Monetization | annual price | ● | Core USD 99.99/year ($8.33/mo equivalent); Plus USD 199.99/year ($16.67/mo). App Store IAPs: 'Yearly Subscription' $99.99, 'Yearly Plus Subscription' $199.99, 'Monarch Su… | S13, S10, S58 |
| Monetization | lifetime price | ○ | Only monthly or yearly billing; gift subscriptions exist. | S58 |
| Monetization | what Pro gates (the meaningful boundary) | ● | Core includes everything day-to-day (sync, budgets, goals, reports, recurring, AI assistant and weekly recap, household and advisor sharing, Zillow/Coinbase/Apple Card, r… | S13, S38 |
| Future Finance | savings goals | ● | Save Up goals with target, date, monthly contribution, growth rates, allocations, 'spending reduces progress' mode, linked accounts. | S33 |
| Future Finance | investments | ● | Synced and manual holdings, time-weighted returns vs S&P 500 benchmark, allocation by asset class, prices from Financial Modeling Prep; equity compensation tracking; Plus… | S59 |
| Future Finance | net worth | ● | Net worth across all assets and liabilities with history, dashboard widget, AI explanations of changes; Plus forecasts it forward. | S39, S13 |
| Future Finance | loans / mortgages | ● | Loan and mortgage liability accounts (synced or manual), Bill Sync statement data via Spinwheel (US), Pay Down goals with interest projections and payoff scenarios; Forec… | S29, S25 |
| Future Finance | assets (property, vehicles) | ● | Zillow Zestimate for homes (weekly refresh), VinAudit vehicle values by VIN (monthly), manual valuables; Zillow/VinAudit US only. | S23 |
| Capture | Siri Shortcut / Quick Action for receipt scanning (added) | ◐ | Version 2.0.91 (Apr 2026) added a Home Screen widget, a Siri Shortcut and a home-screen Quick Action that launch receipt scanning; receipts article confirms long-pressing… | S10, S7 |
| Automation | MCP connector (AI-tool data access) (added) | ◐ | Official Monarch MCP Connector exists so members can use their Monarch data with AI tools of their choice; temporarily paused since around June 29 2026 because a data pro… | S14 |
| Future Finance | credit score tracking (added) | ● | Credit score on the dashboard via Spinwheel (VantageScore 3.0, Equifax data), monthly updates, progress graph after three months, notification on >20-point change, visibl… | S60, S26 |
| Organization | merchant merge and custom merchant logos (added) | ● | Merge merchants appearing under different names in Merchant settings; upload custom images/logos for merchants and accounts. | S20, S61 |
| Privacy / Platform | demo mode (mask all real figures) (added) | ● | Mobile-only Demo Mode masks balances, net worth, transactions and charts across the main screens and disables edits; toggled from Settings. | S56 |
| Budgeting / Planning | multi-month budget planning grid (added) | ◐ | Web-only Budget Calendar View: edit all 12 monthly budgets per category in a grid, with month, year and decade views (10-year span) for planning known future expenses. | S36 |
| Privacy / Platform | login security (MFA, OTP email, SSO) (added) | ● | Optional TOTP multi-factor authentication with recovery codes (set up on web), one-time passcode email on login, Google/Apple sign-in, password-breach warnings. | S51, S54 |
| Spending / Money | account-level financial fields (APR, credit limit, min/planned payment, APY) (added) | ● | Edit Accounts lets credit cards carry APR and credit limit, loans an interest rate (fixed/variable), liabilities minimum and planned monthly payments, deposit accounts AP… | S61 |
| Monetization | money-back guarantee and gift subscriptions (added) | ● | Money-back guarantee after subscribing (App Store purchases excluded, refunded only by Apple); gift subscriptions referenced in 2.0.116 release notes; referral gift-card… | S43, S62, S10 |

Sources:

- S1: https://help.monarch.com/hc/en-us/articles/360058441811-Creating-Manual-Transactions
- S2: https://help.monarch.com/hc/en-us/search?query=voice
- S3: https://help.monarch.com/hc/en-us/articles/37526856682260-AI-in-Monarch
- S4: https://help.monarch.com/hc/en-us/articles/16116906962452-About-Monarch-s-AI-Features
- S5: https://help.monarch.com/hc/en-us/articles/24178098173076-Syncing-Your-Apple-Card-Cash-and-Savings
- S6: https://help.monarch.com/hc/en-us/search?query=Live%20Activity
- S7: https://help.monarch.com/hc/en-us/articles/44244210547860-Importing-Receipts-into-Monarch
- S8: https://www.monarch.com/blog/july-product-update
- S9: https://help.monarch.com/hc/en-us/articles/8611706513684-Using-Mobile-Widgets
- S10: https://apps.apple.com/us/app/monarch-budget-track-money/id1459319842
- S11: https://help.monarch.com/hc/en-us/articles/36463599367188-Using-the-Retail-Sync-Extension
- S12: https://help.monarch.com/hc/en-us/articles/38610714553108-CommandK-Search-Bar-and-Shortcuts
- S13: https://www.monarch.com/pricing
- S14: https://help.monarch.com/hc/en-us/articles/50207234679956-Monarch-MCP-Connector
- S15: https://help.monarch.com/hc/en-us/articles/360048883771-Creating-Custom-Categories-and-Groups
- S16: https://help.monarch.com/hc/en-us/articles/4409690120596-Organizing-Transactions-with-Tags
- S17: https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports
- S18: https://help.monarch.com/hc/en-us/articles/5528707082516-Reviewing-Transactions
- S19: https://help.monarch.com/hc/en-us/articles/360048393372-Transaction-Rules
- S20: https://help.monarch.com/hc/en-us/articles/28953573066260-Tips-Tricks-for-Using-Monarch
- S21: https://help.monarch.com/hc/en-us/articles/360056422791-Adding-Notes-and-Attachments-to-a-Transaction
- S22: https://help.monarch.com/hc/en-us/articles/33707613533972-Understanding-Data-Providers-and-Connections
- S23: https://help.monarch.com/hc/en-us/articles/4404739126548-Tracking-your-property-vehicles-and-valuables
- S24: https://help.monarch.com/hc/en-us/articles/360048393292-Transfers-and-Credit-Card-Payments
- S25: https://help.monarch.com/hc/en-us/articles/29446697869076-Getting-Started-with-Bill-Sync
- S26: https://help.monarch.com/hc/en-us/articles/29446751546516-Connecting-to-Spinwheel
- S27: https://www.monarch.com/blog/september-product-update
- S28: https://help.monarch.com/hc/en-us/articles/4890751141908-Tracking-Recurring-Expenses-and-Bills
- S29: https://help.monarch.com/hc/en-us/articles/44373293932052-Using-Pay-Down-Goals
- S30: https://help.monarch.com/hc/en-us/articles/360048393552-International-Accounts-and-Currency
- S31: https://help.monarch.com/hc/en-us/articles/20504904768020-Cash-Flow
- S32: https://help.monarch.com/hc/en-us/articles/360048883631-Creating-Your-Budget-in-Monarch
- S33: https://help.monarch.com/hc/en-us/articles/44373110771860-Introducing-Goals-3-0
- S34: https://help.monarch.com/hc/en-us/articles/4411119762196-Rollover-Budgets
- S35: https://help.monarch.com/hc/en-us/articles/32125337244052-Using-Flex-Budgeting
- S36: https://help.monarch.com/hc/en-us/articles/360051885292-Budget-Calendar-View
- S37: https://help.monarch.com/hc/en-us/articles/48344305092244-Forecasting-in-Monarch
- S38: https://help.monarch.com/hc/en-us/articles/48349699981972-Monarch-Plus-Tier
- S39: https://help.monarch.com/hc/en-us/articles/4402543752468-Monthly-Progress-Report
- S40: https://help.monarch.com/hc/en-us/articles/360050178492-Splitting-Transactions
- S41: https://help.monarch.com/hc/en-us/articles/20926382202004-Monarch-for-Couples-and-Households
- S42: https://help.monarch.com/hc/en-us/articles/42228648365076-Shared-Views-in-Monarch
- S43: https://help.monarch.com/hc/en-us/articles/19985735202068-Monarch-FAQs
- S44: https://apps.apple.com/ar/app/monarch-budget-track-money/id1459319842
- S45: https://help.monarch.com/hc/en-us/articles/4409682789908-Importing-Transactions-Manually
- S46: https://help.monarch.com/hc/en-us/articles/15526600975764-Downloading-Transaction-or-Account-History
- S47: https://help.monarch.com/hc/en-us/articles/360048393352-Guide-to-Connecting-Your-Accounts
- S48: https://help.monarch.com/hc/en-us/articles/360048393572-Privacy-and-Security
- S49: https://help.monarch.com/hc/en-us/sections/32460956885780-Sign-in-Security
- S50: https://www.monarch.com/download
- S51: https://help.monarch.com/hc/en-us/articles/360054392152-Multi-Factor-Authentication
- S52: https://help.monarch.com/hc/en-us/search?query=Face%20ID
- S53: https://help.monarch.com/hc/en-us/search?query=Face+ID
- S54: https://help.monarch.com/hc/en-us/articles/35673146932628-Login-Issues-Security
- S55: https://help.monarch.com/hc/en-us/articles/4407859794580-Hiding-an-Account
- S56: https://help.monarch.com/hc/en-us/articles/46153716425876-Demo-Mode
- S57: https://play.google.com/store/apps/details?id=com.monarchmoney.mobile&hl=en&gl=US
- S58: https://help.monarch.com/hc/en-us/articles/9136169422996-Pricing
- S59: https://help.monarch.com/hc/en-us/articles/41855507661076-Investments-in-Monarch
- S60: https://help.monarch.com/hc/en-us/articles/38550304735508-Viewing-Your-Credit-Score
- S61: https://help.monarch.com/hc/en-us/articles/360058636951-Edit-Accounts
- S62: https://help.monarch.com/hc/en-us/search?query=Apple+Watch
- S63: https://itunes.apple.com/lookup?id=1459319842&country=us
- S64: https://itunes.apple.com/lookup?id=1459319842&country=ar
- S65: https://itunes.apple.com/lookup?id=1459319842&country=ca
- S66: https://www.monarch.com/
- S67: https://www.monarch.com/features/tracking
- S68: https://www.monarch.com/features/budgeting
- S69: https://www.monarch.com/features/planning
- S70: https://www.monarch.com/whats-new
- S71: https://www.monarch.com/canada
- S72: https://help.monarch.com/hc/en-us/articles/360048393272-Getting-Started-with-Monarch
- S73: https://help.monarch.com/hc/en-us/search?query=Splitwise
- S74: https://help.monarch.com/hc/en-us/search?query=Apple%20Watch

## YNAB

Product as audited: YNAB (You Need A Budget). Official site: https://www.ynab.com/. Second reader's overall confidence: high.

Could not verify: Apple Watch app feature set (complications, on-watch transaction entry): no support article exists; only App S…; Live Activities / Dynamic Island: no mention anywhere; absence not explicitly stated.; Instalment (cuotas) purchases and early instalment payoff: no article found; no explicit statement of absence.; Notification-based capture (reading bank/payment notifications) and automatic recurring-charge detection: no a…; Name of the European open-banking provider: the support article says only 'our import provider'; a third-party…; Exact Apple-managed trial length: the pricing page says 34 days (web sign-up) while the trial support article…; Offline behaviour details: the features page claims offline functionality for the apps, but no support article…; Merchant logos: no evidence either way.; WebSearch budget was exhausted mid-task, so the ynab.com/whats-new/card-mode slug and some support articles we….

| Group | Capability | Status | What the source says | Sources |
| --- | --- | --- | --- | --- |
| Capture | manual entry | ● | Add Transaction button on Home, Plan, Spending, Accounts tabs and each register; amount keypad with calculator (multiply/divide added 2026), type picker (Spending, Inflow… | S1, S2, S3 |
| Capture | voice capture | ◐ | No in-app voice entry. Siri works through user-built Shortcuts (name a shortcut and say it) and, on iOS 26, Siri/Spotlight can show a category balance whose result is tap… · 2nd reader: Status holds, but the right primary source is the dedicated Siri/Spotlight article: on iOS 26 the phrases are 'Add new transaction in YNAB' (opens the… | S4, S1, S5 |
| Capture | multi-entry voice (several movements in one utterance) | ○ | The only voice path is the Add New Transaction Shortcut action, which opens one Add Transaction screen with optional preset fields (it can prefill several split categorie… | S4, S1 |
| Capture | AI categorization | ◐ | Automatic categorization is rule-based, not AI: each payee keeps a default category that changes only when 2 of the 3 most recent categorizations agree (Aug 2026); users… | S6, S7, S8 |
| Capture | Apple Pay / Wallet Shortcut capture | ◐ | Not a per-tap Apple Pay capture. YNAB has an 'Apple Wallet connection' that imports transactions from first-party Apple accounts (Apple Card, Apple Cash, Savings with App… | S9, S10, S11 |
| Capture | Dynamic Island / Live Activity | ? | No support article, what's-new post or App Store release note (last 14 versions reviewed) mentions Live Activities or the Dynamic Island; the 'outside the app' list names… | S12, S13 |
| Capture | WhatsApp / messaging capture | ○ | The article that lists every way to get transactions in (in-app button, category long-press, widgets, Shortcuts, Siri/Spotlight, app-icon quick action, Direct Import, fil… | S1 |
| Capture | widgets (Home/Lock Screen) | ● | iOS 18+ Home Screen widgets in three sizes showing 1, 3 or 7 category balances (tap a category to add a transaction with it prefilled), plus an iPhone-only Add Transactio… · 2nd reader: Confirmed: iOS 18+/iPadOS 18+ Home Screen widgets in small (1 category), medium (3) and large (7), iPhone-only Add Transaction widget, stackable; Andr… | S14, S4, S1 |
| Capture | Quick Actions (home-screen long-press) | ● | Long-pressing the app icon offers a Transaction action (which can also be dragged out as a pseudo-widget) and the Require/Don't Require Face ID toggle. | S14, S15 |
| Capture | external integrations / Shortcuts / App Intents | ● | Five Shortcuts actions: Add New Transaction (amount, inflow/outflow, payee, category, account; can prefill split categories), Find Category (filter/sort/limit), Open Cate… | S4, S16, S17 |
| Organization | categories | ● | Two-level structure: Category Groups containing categories; created, renamed, reordered and deleted in the Plan tab / Edit Plan; emoji in names; ready-made category templ… | S12, S18 |
| Organization | custom categories | ● | Fully user-defined categories and groups; new categories can be created from inside the transaction editor. | S19, S20 |
| Organization | tags | ◐ | No free-form tags. One coloured flag per transaction (colours can be given custom names) plus hashtag-style text in the memo, both searchable; flags are positioned for re… | S21, S22 |
| Organization | subcategories | ◐ | Only two levels exist (Category Group then category); no deeper nesting. | S12, S23 |
| Organization | search | ● | Search in the Spending tab and in each account (iOS, Android, web) with suggested terms and stacked multi-criteria searches: amounts (with comparison operators on web), p… | S22 |
| Organization | filters | ● | Search terms act as filters; web View menu narrows by time frame; a 'Matched' filter was added in 26.35 (Sep 2026); reports filter by categories, accounts and date preset… | S22, S24 |
| Organization | merchant intelligence (normalisation, logos, rules) | ◐ | Imported payees are cleaned of bank noise; editing a payee once creates an IS renaming rule, and CONTAINS rules can be built on the web; payees can be combined, hidden or… | S11, S25, S26 |
| Organization | notes | ● | Memo field on every transaction (multi-line; checkmark saves as of 26.37) and category notes (noted as excluded from export). | S1, S23 |
| Organization | attachments / receipts | ● | A photo can be attached to a transaction on iOS and Android (added in 26.16 per App Store history); search has Has Photo/No Photo on mobile; web can view and download pho… | S22, S23, S27 |
| Spending / Money | accounts | ● | Four types: Cash (Checking, Savings, Cash), Credit (Credit Card, Line of Credit), Loan (Mortgage, Auto, Student, Personal, Medical, Other Debt) and Tracking (Asset, Liabi… | S28 |
| Spending / Money | credit cards | ● | Dedicated Credit Card account type with an auto-created paired Credit Card Payment category; funded spending moves cash from the spending category into the payment catego… | S29, S30 |
| Spending / Money | statement cycles (closing/due dates) | ○ | The credit card model is calendar-month based (prior balance at the start of the month, this month's spending and payments); no closing or due date fields are described a… | S29 |
| Spending / Money | installments (cuotas) | ? | No article among the 247 in the support sitemap covers instalment purchases; a credit purchase is a single transaction and loans are a separate account type. | S31, S28 |
| Spending / Money | refunds | ● | A refund is recorded as an inflow categorised to the original spending category; Spending Breakdown has a 'positive inflow categories' section for categories where inflow… | S24, S32, S33 |
| Spending / Money | early installment payoff | ? | No instalment concept found; for loans, extra payments beyond interest go to principal and the Loan Planner simulates payoff dates, but nothing about instalment plans. | S34 |
| Spending / Money | recurring expenses | ● | Scheduled transactions with frequencies daily, weekly, every other week, twice a month, every four weeks, monthly, every other month, every 3/4 months, twice a year, year… | S19 |
| Spending / Money | subscriptions | ◐ | Handled as scheduled repeating transactions and category targets; there is no dedicated subscription tracker or report. | S19, S35 |
| Spending / Money | debts / receivables (personal loans) | ◐ | Money you owe: Loan accounts (Personal Loan type) or a Tracking Liability account ('money owed between family or friends'). | S28, S36, S21 |
| Spending / Money | multiple currencies | ○ | A plan has exactly one currency and all its accounts must share it; the official guidance is to create a separate plan per currency and move money between them with manua… | S37, S17 |
| Spending / Money | FX semantics | ○ | No original-currency amount is stored and there is no rate source: the user enters an estimated converted amount in the plan's currency (optionally flagged for review) an… | S37 |
| Spending / Money | cash flow view | ◐ | Mobile: Income vs. Spending, a fixed six-month comparison with a three-way verdict (within 5%, spending less, spending more), not filterable. | S32, S35 |
| Spending / Money | future commitments / upcoming payments | ● | Scheduled transactions are listed in a collapsible Scheduled section at the top of registers and the Spending tab, and surface as upcoming amounts inside the affected cat… | S19, S20 |
| Budgeting / Planning | total budget | ● | Zero-based: all cash is 'Ready to Assign' until given to categories; Edit Plan / Cost to Be Me totals all targets against expected income for the month and previews next… | S20, S38 |
| Budgeting / Planning | category budgets | ● | Each category has Assigned, Activity and Available; targets per category with weekly, monthly, yearly or custom cadence and 'Set aside another' / 'Refill up to' / 'Have a… | S39, S40 |
| Budgeting / Planning | goals | ● | Targets double as savings goals (custom target with a 'By' date and 'Have a balance of' behaviour); a 'Current Goal' can be pinned to the mobile Home tab; loan payoff tar… | S40, S12 |
| Budgeting / Planning | flexible vs fixed budgets / rollover | ● | Unspent Available money always rolls forward; 'Refill up to' targets only ask for what was spent, 'Set aside another' accumulates; moving money between categories at any… | S39 |
| Budgeting / Planning | pay-cycle periods (custom month start / salary cycles) | ○ | Monthly targets explicitly follow the calendar month; weekly targets let you pick the week start day, and biweekly targets are stated as not available (workarounds offere… | S39 |
| Budgeting / Planning | calendar view | ○ | The Reflect overview enumerates every report (Net Worth, Spending Breakdown, Spending Trends, Income v Expense, Income vs Spending, Age of Money) and the mobile spaces ar… | S35, S12 |
| Budgeting / Planning | projections / forecasts | ◐ | Philosophically against forecasting (glossary: planning with money you do not have yet). Limited forward views: assign money to future months, Cost to Be Me next-month pr… | S41, S20, S34 |
| Budgeting / Planning | reminders | ◐ | Push notifications for imported transactions to approve, overspending, income received, connection problems and trial status; scheduled transactions act as bill reminders… | S33, S19 |
| Reporting | by category | ● | Spending Breakdown (web and mobile): categories ranked by share of spending, filter by category/account, month or preset ranges, tap through to transactions. | S24 |
| Reporting | daily | ○ | Report granularity is monthly; the full report list contains no daily view. | S35, S42 |
| Reporting | trends over time | ● | Spending Trends (web only) shows monthly bars by category group, drillable to category and transaction, exportable; Net Worth and Age of Money line charts on web and mobi… | S42, S43 |
| Reporting | period comparisons | ◐ | Month-by-month bars in Spending Trends and the six-month Income vs Spending; no explicit 'this period vs last period' comparison. | S42, S32 |
| Reporting | by merchant | ◐ | Spending Trends cannot drill by payee; the documented workaround is searching a payee in All Accounts and reading the selected total. | S42 |
| Reporting | subscriptions report | ○ | Not among the enumerated reports. | S35 |
| Reporting | calendar report | ○ | Not among the enumerated reports. | S35 |
| Reporting | custom date ranges | ● | Web reports accept custom ranges; mobile Spending Breakdown offers a single month or presets (last 3/6/12 months, year to date, previous year, all dates). | S24 |
| Reporting | AI-generated reports | ○ | No AI features anywhere in the product: not on the homepage, features page, the ten most recent what's-new posts or 14 App Store release notes. | S44, S45, S16 |
| Reporting | explain / query financial data in natural language | ○ | No native natural-language querying; the API docs list unofficial community MCP servers and a GPT as the only such route. | S16, S17 |
| Collaboration | split expenses | ◐ | 'Split' in YNAB means splitting one transaction across categories (or a transfer line for cash back), not between people. Sharing costs with others is handled by conventi… | S46, S47 |
| Collaboration | equal split | ◐ | Only across categories: leaving split lines at zero auto-distributes the total evenly; a remainder can be distributed proportionally. | S46 |
| Collaboration | percentage split | ○ | Split lines take amounts only; no percentage mode is described in the split article. | S46 |
| Collaboration | share-based split | ○ | No share/weight mode; amounts only. | S46 |
| Collaboration | exact-amount split | ◐ | Exact amounts per category line, with auto-distribution of the remainder; not per person. | S46 |
| Collaboration | groups | ◐ | YNAB Together: one subscriber (group manager) invites up to five members; each has their own login, unlimited plans, and chooses which plans to share with full edit acces… | S48, S49 |
| Collaboration | invitations / participants without accounts | ○ | Every group member needs a YNAB login; invitations go to new or existing YNAB users. | S48 |
| Collaboration | household / partner shared finances | ● | Shared plans with full edit access for partners/family under one subscription; web shows avatars for who moved money; guidance for shared credit cards. | S48, S36 |
| Collaboration | debt simplification | ○ | Who-owes-whom netting is explicitly delegated to Splitwise/Venmo Groups; YNAB only records the settle-up transaction. | S47 |
| Automation | Apple Pay capture automation | ◐ | Apple Wallet connection imports Apple Card/Apple Cash/Savings (US) and UK open-banking accounts automatically via one authorising iPhone with Background App Refresh; not… | S9, S10 |
| Automation | Mercado Pago sync | ○ | Direct Import covers the US, Canada, the UK and 17 European countries only; no Latin American country or wallet is supported. | S50, S51 |
| Automation | bank sync (aggregator/open banking) | ● | Aggregators MX and Plaid (YNAB picks whichever performs best per bank); Europe via an unnamed open-banking provider (PSD2) in Austria, Belgium, Denmark, Estonia, Finland,… · 2nd reader: Status confirmed (MX and Plaid; 18 European countries listed verbatim: Austria, Belgium, Denmark, Estonia, Finland, France, Germany, Ireland, Italy, L… | S51, S50 |
| Automation | imports (generic) | ● | File-Based Import accepts CSV (preferred, with built-in converter and column mapping, semicolon delimiters, swap inflow/outflow, remembered per account), OFX, QFX and QIF… | S52, S7 |
| Automation | CSV import/export | ● | Import: CSV on web/iPad. Export: web only, whole plan + all transactions as two CSV/TSV files, or selected transactions; report exports (Net Worth, Income v Expense, Spen… | S23, S53 |
| Automation | Excel import/export | ○ | Export formats are CSV/TSV only; import formats are CSV, OFX, QFX, QIF only ('unable to read other file types'). | S23, S52 |
| Automation | JSON import/export | ◐ | No in-app JSON export; the public REST API returns full plan data as JSON (delta requests supported) and accepts transactions with import_id. | S16, S23 |
| Automation | notification-based automation (reading bank/payment notifications) | ? | The notifications article covers only outgoing YNAB notifications; no article describes reading device notifications. No explicit statement of absence found. | S33 |
| Automation | recurring detection | ? | Recurring items are user-created scheduled transactions, which then auto-match imports; no automatic detection of recurring charges is described, and no statement of abse… | S19 |
| Privacy / Platform | local-first / on-device data | ○ | Cloud-hosted service: data lives on YNAB's servers and is loaded on login (web loads recent months first); account required; features page advertises real-time sync with… | S54, S45 |
| Privacy / Platform | account required or not | ● (● = account required) | An account (email/password or Sign in with Google/Apple) is required; subscription managed through YNAB, Apple or Google. | S55, S56 |
| Privacy / Platform | cloud sync | ● | Own cloud sync across web, iOS, Android and Watch; Apple Wallet imports set up on one iPhone sync to all other devices. | S45, S9 |
| Privacy / Platform | iCloud / CloudKit | ○ | Sync is YNAB's own server-side sync tied to a YNAB login, not iCloud; no article mentions iCloud. | S45, S31 |
| Privacy / Platform | Face ID / app lock | ● | Face ID/Touch ID/passcode on iOS (toggled from the app icon quick action), fingerprint/passcode/pattern on Android; re-auth after a five-minute grace period; Android lock… | S15 |
| Privacy / Platform | hidden amounts (privacy mode) | ● | Hide Amounts replaces every figure with six dots on iOS, Android and web (web added June 2026); amounts are not editable while hidden; persists until turned off; also use… | S57, S58 |
| Privacy / Platform | Apple Watch | ● | Apple Watch app listed in the official lineup and in App Store compatibility (watchOS 9.0+); no support article detailing its features was found, so complications and on-… · 2nd reader: Existence re-confirmed only: App Store compatibility lists Apple Watch (watchOS 9.0 or later) and the lineup page names 'YNAB for Apple Watch'. | S59, S27, S60, S61, S62 |
| Privacy / Platform | widgets | ● | See CAPTURE/widgets: iOS Home Screen category widgets (1/3/7) and Add Transaction widget; Android small/large widgets; none on web. | S14 |
| Privacy / Platform | accessibility (VoiceOver, Dynamic Type) evidence | ● | App Store accessibility section lists VoiceOver, Voice Control, larger text, dark interface, reduced motion, sufficient contrast, captions and colour-independent informat… · 2nd reader: Strengthened: a dedicated support article states YNAB supports Dynamic Type on iOS (larger accessibility sizes 'may not be supported'), VoiceOver on i… | S27, S3, S63 |
| Privacy / Platform | localization (languages, regions) | ◐ | App Store lists English as the only language on both US and AR storefronts; plan settings allow any currency symbol, number format and date format (mm/dd, dd/mm, yyyy/mm/… | S64, S22, S23 |
| Privacy / Platform | Android availability | ● | Full-featured Android app (Play Store subscription), with widgets, app lock, Geo Payees; some features lag iOS (Card Mode iOS-only at the time of the article; Hide Amount… · 2nd reader: Status confirmed, but the note 'Card Mode iOS-only at the time of the article' is wrong: the approving/matching article has an Android section for Car… | S59, S65, S57, S66, S67 |
| Privacy / Platform | web availability | ● | Web app at app.ynab.com is the flagship; several features are web-only (Manage Payees, renaming CONTAINS rules, exports, Spending Trends, Income v Expense, file import, b… | S59, S25, S35 |
| Monetization | free tier and its limits | ○ | Subscription only; no free tier on the pricing page or App Store listing. | S68, S27 |
| Monetization | trial | ● | 34-day free trial with no card when signing up on the web; Apple-managed trials (referred to as 30 days in the support article) auto-convert unless cancelled in the App S… · 2nd reader: Confirmed with one added fact: the support article gives three different lengths by channel: Apple App Store trial 30 days, Google Play trial 34 days,… | S68, S56, S44 |
| Monetization | monthly price | ● | USD 14.99/month on the pricing page; App Store IAP 'YNAB Subscription' $14.99 on both the US and Argentina storefronts (AR storefront prices in USD). | S68, S27, S64 |
| Monetization | annual price | ● | USD 109/year (about 9.08/month) on the pricing page; App Store IAP 'YNAB Subscription' $109.00 on US and AR storefronts; taxes extra. | S68, S27, S64 |
| Monetization | lifetime price | ○ | No lifetime option on the pricing page or in the App Store IAP list (only the two subscription SKUs). | S68, S27 |
| Monetization | what Pro gates (the meaningful boundary) | ● | Single tier: the subscription is the product (everything: sync, bank import, reports, targets, loan planner, YNAB Together sharing for up to six people). | S68, S49 |
| Future Finance | savings goals | ● | Savings categories with custom targets ('Have a balance of X by date'), monthly set-aside targets, Current Goal on Home; savings accounts are cash accounts whose money mu… | S40, S28 |
| Future Finance | investments | ◐ | Tracking Asset accounts hold a balance updated manually by reconciling (gains, dividends recorded as balance adjustments); no holdings, prices or market data; linked inve… | S69, S28 |
| Future Finance | net worth | ● | Net Worth report on web and mobile: month-end assets vs debts and trend line, filter by accounts and date range, export (web), shareable image with optional hidden amount… | S43 |
| Future Finance | loans / mortgages | ● | Loan accounts (mortgage, auto, student, personal, medical, other) with balance, interest rate, monthly payment, escrow/fees for mortgages, automatic monthly interest char… | S34, S28 |
| Future Finance | assets (property, vehicles) | ◐ | Only generic Tracking Asset accounts (documented for investments) with a manually maintained balance; no property or vehicle types or valuation. | S28 |
| Privacy / Platform | dark mode (added) | ● | Dark mode is offered as a visual theme in the web app (plan name menu, Display Options) and follows the device setting on iOS and Android. | S70 |
| Privacy / Platform | custom app icons (iOS) (added) | ● | Alternate app icons can be chosen inside the iOS app; the article states the feature is not available on Android or desktop. | S67 |
| Privacy / Platform | two-factor authentication (added) | ● | The features page advertises encryption and 2FA for the YNAB login; no support article was read on the exact second factor, so the mechanism (app/SMS/email) is unverified… | S45 |
| Automation | import review (approve / match imported transactions) (added) | ● | Imported transactions arrive unapproved; they auto-match manually entered or scheduled transactions (matched imports now arrive pre-approved) and can be reviewed in List… | S65, S66 |
| Organization | undo / redo (added) | ◐ | Undo and redo buttons exist; on iOS they only revert assigned or moved money (not transactions); the web app has undo/redo with keyboard shortcuts. | S71 |
| Privacy / Platform | iPad-specific layout and file import (added) | ● | iPad gets portrait/landscape layouts and, on Multitasking-capable iPads, File-Based Import via drag-and-drop (iPhone and Android cannot import files). | S72, S52 |
| Collaboration | activity attribution in shared plans (Recent Moves) (added) | ● | The subscription-sharing page describes a Recent Moves feature that tracks plan changes made by any group member; sharing adds no cost and members can create their own pl… | S49 |

Sources:

- S1: https://support.ynab.com/en_us/how-to-add-transactions-in-ynab-HyDwA_byi
- S2: https://support.ynab.com/en_us/geo-payees-on-mobile-a-guide-SJTbcVks
- S3: https://www.ynab.com/whats-new/the-clearest-way-to-enter-transactions
- S4: https://support.ynab.com/en_us/shortcuts-on-ios-a-guide-Bk_lHa5Aq
- S5: https://support.ynab.com/en_us/using-siri-and-spotlight-with-ynab-B1Me9dj5ge
- S6: https://www.ynab.com/whats-new/categorization-that-matches-your-habits
- S7: https://www.ynab.com/whats-new/file-based-import-elevated
- S8: https://www.ynab.com/
- S9: https://support.ynab.com/en_us/apple-connections-rkShEfrUh
- S10: https://support.ynab.com/en_us/apple-third-party-H1gE_0CRyg
- S11: https://support.ynab.com/en_us/how-to-rename-payees-BkotNUSyo
- S12: https://support.ynab.com/en_us/spaces-in-the-mobile-app-S1iIZQoqgg
- S13: https://apps.apple.com/us/app/ynab/id1010865877?see-all=version-history
- S14: https://support.ynab.com/en_us/ynab-widget-for-mobile-a-guide-HJPEEQYR9
- S15: https://support.ynab.com/en_us/how-to-enable-and-disable-touch-id-face-id-and-app-lock-SyjrFNtR5
- S16: https://api.ynab.com/
- S17: https://support.ynab.com/en_us/the-ynab-api-an-overview-BJMgQ3zAq
- S18: https://support.ynab.com/en_us/category-templates-HknjS_RA
- S19: https://support.ynab.com/en_us/scheduled-transactions-a-guide-BygrAIFA9
- S20: https://support.ynab.com/en_us/plan-and-adjust-with-edit-plan-and-cost-to-be-me-ByR7vpqPyx
- S21: https://support.ynab.com/en_us/flags-a-guide-Skh8Xb4kj
- S22: https://support.ynab.com/en_us/searching-transactions-a-guide-r1gxyQryj
- S23: https://support.ynab.com/en_us/how-to-export-plan-data-Sy_CouWA9
- S24: https://support.ynab.com/en_us/spending-breakdown-H1H7YxmD0
- S25: https://support.ynab.com/en_us/how-to-add-edit-and-delete-payees-rkxMu4Skj
- S26: https://support.ynab.com/en_us/my-payees-are-wrong-rJS5xITwxx
- S27: https://apps.apple.com/us/app/ynab/id1010865877
- S28: https://support.ynab.com/en_us/account-types-an-overview-BkmGM0qCq
- S29: https://support.ynab.com/en_us/credit-card-activity-an-overview-Sk2mLluA9
- S30: https://www.ynab.com/whats-new/credit-card-payments-have-met-their-match
- S31: https://support.ynab.com/sitemap.xml
- S32: https://support.ynab.com/en_us/income-v-expense-Byu1BYWRq
- S33: https://support.ynab.com/en_us/managing-notifications-a-guide-HySdCwtCc
- S34: https://support.ynab.com/en_us/loan-accounts-a-guide-HkNSkPHJi
- S35: https://support.ynab.com/en_us/reflect-in-ynab-B1GJsrWkj
- S36: https://support.ynab.com/en_us/managing-shared-credit-cards-a-guide-Hkm6ob_Cq
- S37: https://support.ynab.com/en_us/using-multiple-currencies-in-ynab-a-guide-SyBF6PHno
- S38: https://support.ynab.com/en_us/plan-resets-and-fresh-starts-HkXYR_c0q
- S39: https://support.ynab.com/en_us/getting-started-with-targets-ryAEP08xC
- S40: https://support.ynab.com/en_us/how-to-use-targets-rk5kkI9ks
- S41: https://support.ynab.com/en_us/ynab-glossary-a-guide-BJd80SORq
- S42: https://support.ynab.com/en_us/spending-trends-H1inlhzAc
- S43: https://support.ynab.com/en_us/net-worth-BkwQO5WA5
- S44: https://www.ynab.com/whats-new
- S45: https://www.ynab.com/features
- S46: https://support.ynab.com/en_us/split-transactions-a-guide-SJLEKwY0q
- S47: https://support.ynab.com/en_us/splitwise-and-ynab-a-guide-H1GwOyuCq
- S48: https://support.ynab.com/en_us/ynab-together-B1nS78Cki
- S49: https://www.ynab.com/features/subscription-sharing
- S50: https://support.ynab.com/en_us/direct-import-in-europe-Syae1z_A9
- S51: https://support.ynab.com/en_us/how-direct-import-works-H1IGYLgnxl
- S52: https://support.ynab.com/en_us/file-based-import-a-guide-Bkj4Sszyo
- S53: https://support.ynab.com/en_us/how-to-export-reflection-data-Bykou09
- S54: https://support.ynab.com/en_us/loading-your-data-in-the-ynab-app-S1F63hUDWl
- S55: https://support.ynab.com/en_us/how-to-manage-your-subscription-BJXBVDb0q
- S56: https://support.ynab.com/en_us/your-ynab-trial-ry87vWAc
- S57: https://support.ynab.com/en_us/hide-amounts-ry0jgLaOJg
- S58: https://www.ynab.com/whats-new/show-your-plan-hide-the-amounts
- S59: https://www.ynab.com/our-app-lineup
- S60: https://support.ynab.com/sitemap-articles-1.xml
- S61: https://support.ynab.com/sitemap-articles-2.xml
- S62: https://support.ynab.com/sitemap-articles-3.xml
- S63: https://support.ynab.com/en_us/accessibility-tools-and-features-an-overview-HkmxC7W1j
- S64: https://apps.apple.com/ar/app/ynab/id1010865877
- S65: https://support.ynab.com/en_us/approving-and-matching-transactions-a-guide-ByYNZaQ1i
- S66: https://www.ynab.com/whats-new/meet-card-mode-transactions-meant-to-be-swiped
- S67: https://support.ynab.com/en_us/how-to-choose-a-custom-app-icon-on-ios-H1ewFB_Ac
- S68: https://www.ynab.com/pricing
- S69: https://support.ynab.com/en_us/tracking-investment-accounts-a-guide-r1Bzjxd05
- S70: https://support.ynab.com/en_us/how-to-enable-dark-mode-rJQOmvYA9
- S71: https://support.ynab.com/en_us/how-to-fix-mistakes-with-undo-and-redo-HJzO5CfA9
- S72: https://support.ynab.com/en_us/using-ynab-on-an-ipad-a-guide-BkzOqBdAq
- S73: https://www.ynab.com/release-notes
- S74: https://www.ynab.com/whats-new/give-your-priorities-a-reset
- S75: https://support.ynab.com/en_us/age-of-money-H1ZS84W1s

## Wallet

Product as audited: Wallet by BudgetBakers (App Store title: "Wallet - Daily Budget & Profit" on /us, "Wallet - Money Management" on /ar; Android package com.droid4you.application.…. Official site: https://budgetbakers.com/en/products/wallet/. Second reader's overall confidence: medium.

Could not verify: Mapping of App Store IAP SKUs to durations: the listing shows four unlabelled 'Premium' entries (US $5.99/$14.…; Length of the Premium trial (article confirms a trial exists but not its duration).; Exact free-tier account limit and which dashboard charts are paid-only (official text only says 'unlimited acc…; Which third-party aggregators back the bank sync (official pages only cite BudgetBakers' own PSD2/CNB AISP lic…; iOS Home/Lock Screen widgets, Quick Actions, Live Activities/Dynamic Island and accessibility support: no offi…; Exchange-rate data source and whether historical rates are kept per record (docs describe app-wide current rat…; Zendesk help-centre HTML pages returned HTTP 403 to fetchers; content was read through the public Zendesk Help…; Google Play 'What's new' text for the Android build (listing fetched but release notes not extracted); Android…; WebSearch budget was exhausted before confirming Apple Watch/widget claims via secondary sources; absence of W….

| Group | Capability | Status | What the source says | Sources |
| --- | --- | --- | --- | --- |
| Capture | manual entry | ● | Income/Expense/Transfer records with amount, account, category, note, labels, payee, date, payment type, warranty, status, location and receipts on iOS and Android; templ… | S1, S2 |
| Capture | voice capture | ○ | No voice entry anywhere in the help centre's 86 articles, the product/feature pages or the store descriptions; the only capture modes listed are bank sync, Apple Pay/Goog… | S3, S4 |
| Capture | multi-entry voice (several movements in one utterance) | ○ | No voice capture at all (see above). The MCP integration lets an external AI assistant add many transactions from a bank statement, but that is a desktop AI-client workfl… | S5 |
| Capture | AI categorization | ● | Machine-learning categorisation of records into a fixed main-category/subcategory tree; learns from user corrections (e.g. | S6, S7 |
| Capture | Apple Pay / Wallet Shortcut capture | ● | Official Shortcuts automation: Transaction trigger on chosen cards runs the app's 'Add transaction to Wallet' action with Shortcut Input amount and merchant into a chosen… | S8, S9 |
| Capture | Dynamic Island / Live Activity | ? | No mention in help centre, release notes 5.2-5.7.4 or product pages; absence of any documentation but no explicit statement. | S9 |
| Capture | WhatsApp / messaging capture | ○ | Not among the documented capture methods; the help centre explicitly says the company never communicates via SMS/WhatsApp/Messenger. | S10, S11 |
| Capture | widgets (Home/Lock Screen) | ? | 'Widgets' in Wallet's docs are in-app dashboard cards (balance chart, cash-flow, pie, recurring-payments calendar). No iOS Home/Lock Screen widget is documented on the Ap… | S12, S9 |
| Capture | Quick Actions (home-screen long-press) | ? | Not documented anywhere read. | — |
| Capture | external integrations / Shortcuts / App Intents | ● | Exposes an 'Add transaction to Wallet' Shortcuts action (amount, merchant, account) used by the Apple Pay automation; REST API (beta, Premium) and MCP server (beta, Premi… · 2nd reader: Confirmed: 'Add transaction to Wallet' Shortcuts action (Amount, Merchant, target account); REST API and MCP are 'Available for Premium users only' an… | S8, S13, S5, S14, S15 |
| Organization | categories | ● | Fixed set of main categories and subcategories with icon/colour and a 'nature' (must/need/want); main categories can be renamed or hidden. | S6 |
| Organization | custom categories | ◐ | Users cannot add new main categories (the ML model needs structured data); they can rename/hide main categories and add their own sub-subcategories with icon and colour. | S6 |
| Organization | tags | ● | Labels: up to five per record, optional colour (colour is Premium), can be auto-assigned to every new record, archived, applied via Automatic Rules and used in filters/bu… · 2nd reader: Confirmed (max five labels per record, colour is Premium, archive). Nuance: 'auto-assign to new records' is documented for Android and Web only, not i… | S16, S17 |
| Organization | subcategories | ● | Two-level tree (category > subcategory) plus user-created sub-subcategories. | S6 |
| Organization | search | ● | Full-text search of transactions within a budget; 'Text search' keyword is a filter option on records/analytics. | S18, S19 |
| Organization | filters | ● | Instant filters by date range, accounts, type, category, labels, currency, payment type, status, transfers, debts, text; saved filters on Android and web (saving not yet… | S19 |
| Organization | merchant intelligence (normalisation, logos, rules) | ◐ | Payee field, merchant parsed from Apple/Google Pay notifications, keyword-based Automatic Rules (bank-synced records only); transfer matching learns from corrections. | S7, S20 |
| Organization | notes | ● | Note field on records, templates and planned payments. | S1 |
| Organization | attachments / receipts | ● | Receipts (photos) can be attached to records on iOS and Android (not on web); warranty photos too. No OCR of receipts or statements (explicitly unsupported). | S1, S21 |
| Spending / Money | accounts | ● | Cash account created by default; manual accounts of many types (general, savings, credit card, overdraft, loan, mortgage, investment, insurance), bank-synced accounts; ar… | S3, S9 |
| Spending / Money | credit cards | ● | Credit-card account type with credit limit, choice of showing available credit or owed balance, and a payment due day with reminders; can be bank-synced. | S22, S23 |
| Spending / Money | statement cycles (closing/due dates) | ◐ | Only a payment 'Due Day Of Month' with reminders; no closing date or statement grouping documented. | S22 |
| Spending / Money | installments (cuotas) | ○ | 'Installment Plan' for credit-card purchases (months + interest) is an open user request marked In Progress on the public feedback board; nothing shipped per help centre… | S24 |
| Spending / Money | refunds | ◐ | Refunds are recorded as Income (bank-parity logic); no negative expenses and no per-record exclusion; a 'link/merge/reimbursement' feature is In Progress on the feedback… | S25, S26 |
| Spending / Money | early installment payoff | ○ | No instalment model exists (see installments). | S24 |
| Spending / Money | recurring expenses | ● | Planned Payments: expense/income templates with start date, repeat, manual or automatic confirmation, notifications on due day and 3 days before; convert existing records… · 2nd reader: Status confirmed (Planned Payments on Android and iOS, not web; manual/automatic confirmation; notifications on due day and 3 days before; 31st-day sk… | S27, S28, S29, S30, S31 |
| Spending / Money | subscriptions | ◐ | Subscriptions are handled as planned payments; the feature page says the app suggests recurring payments from detected patterns and helps spot unused subscriptions. | S31 |
| Spending / Money | debts / receivables (personal loans) | ◐ | Debts feature (lent/borrowed, due-date reminders, repayments, forgive/close) is Android only; help centre marks it 'Not available' on iOS and web, and 'Debt tracking for… | S32, S24 |
| Spending / Money | multiple currencies | ● | 150+ currencies claimed; one currency per account (an account cannot mix currencies); default currency cannot be changed later without wiping data; totals roll up to the… · 2nd reader: Status confirmed (one currency per account, overnight automatic rates, manual rates on all platforms, disabling auto-update only on mobile). | S33, S34, S35, S36 |
| Spending / Money | FX semantics | ◐ | Each account keeps its own currency; records/templates can carry a currency; app-wide rates update overnight automatically (can be disabled) or be set manually per curren… | S33, S8, S2 |
| Spending / Money | cash flow view | ● | Cash-flow and balance-trend cards/reports with period-over-period percentage; expected cash balance after upcoming payments. | S37, S31 |
| Spending / Money | future commitments / upcoming payments | ● | Upcoming planned payments card on the dashboard (dates and total), recurring-payments calendar widget, projected balance after upcoming payments. | S27, S34 |
| Budgeting / Planning | total budget | ◐ (was ●) | Budgets overview shows total expenses, total remaining and expected balance at period end across all budgets; a budget can span any set of categories. · 2nd reader: The Setup Budgets article documents per-budget overviews (spent, remaining, predicted expenses, expected balance) and an all-budgets list showing each… | S18, S38, S24 |
| Budgeting / Planning | category budgets | ● | Budgets defined by categories (recommended), accounts or labels; week/month/year or custom period; one-time or recurring; green/orange/red status; overspending alerts. | S18, S39 |
| Budgeting / Planning | goals | ◐ | Savings Goals (target, saved so far, date, icon) exist on Android only; marked 'Not available' on iOS and web; 'Include goals & debts in iOS' is Under Review. | S40, S24 |
| Budgeting / Planning | flexible vs fixed budgets / rollover | ◐ | Budgets can be one-time or recurring and are marketed as 'flexible'/habit-based with predicted spend (spent + planned + average of past periods); no rollover of unspent a… | S18, S39 |
| Budgeting / Planning | pay-cycle periods (custom month start / salary cycles) | ◐ | 'Initial day of the month' setting exists on Android only; marked Not available on iOS and web. | S41 |
| Budgeting / Planning | calendar view | ◐ | A 'recurrent payments calendar' dashboard widget exists; a calendar of all records per day is an open request (More Info status). | S34, S24 |
| Budgeting / Planning | projections / forecasts | ● | Per-budget predicted expenses and expected end balance (5.7.3 added a forecasted-spend breakdown); expected cash balance after planned payments; balance-trend prediction… | S18, S9 |
| Budgeting / Planning | reminders | ● | Planned-payment notifications on due day and 3 days before; credit/overdraft due-day reminders; budget-limit alerts; in-app notifications on account balance limits (5.3,… | S27, S9 |
| Reporting | by category | ● | Pie/expense-structure charts by category and subcategory; statistics currently focus on expenses, with income integration 'being explored'. | S26 |
| Reporting | daily | ◐ | Dashboard is described as useful for daily statistics and the date-range bar can be scrolled; no dedicated daily report documented. | S12, S19 |
| Reporting | trends over time | ● | Balance trend and spending trend (comparison with five previous periods) cards. | S18, S37 |
| Reporting | period comparisons | ● | Period-over-period percentage change on Income & Expense, Cash Flow, Balance Trend and Expense Structure; category comparison to the same period in the past. | S37 |
| Reporting | by merchant | ? | Payee field exists and is filterable in text search, but no payee/merchant report is documented. | S19 |
| Reporting | subscriptions report | ◐ | Upcoming planned payments list/calendar only; no dedicated subscriptions report. | S31 |
| Reporting | calendar report | ◐ | Recurring-payments calendar widget only. | S34 |
| Reporting | custom date ranges | ● | Scrollable/customisable date range bar in Records and Statistics on iOS/Android; date filters on web. | S19 |
| Reporting | AI-generated reports | ◐ | Only through the external MCP integration (Premium, beta): an AI client can request aggregated reports such as spending by category over 3 months. No in-app AI report. | S5, S13 |
| Reporting | explain / query financial data in natural language | ◐ | Via MCP with Claude/ChatGPT/Cursor/Windsurf ('am the researcher over budget this month?'), read-only by default with opt-in writes; Premium beta set up from the web app. | S5, S13 |
| Collaboration | split expenses | ◐ | Inside Wallet, 'split record' (divide one record into several categories) exists on Android only; iOS and web 'not yet available'. | S1, S42 |
| Collaboration | equal split | ◐ | Available in ShareCost (separate app), not in Wallet. | S42 |
| Collaboration | percentage split | ◐ | ShareCost only. | S42 |
| Collaboration | share-based split | ◐ | ShareCost only ('shares' mode). | S42 |
| Collaboration | exact-amount split | ◐ | ShareCost only. | S42 |
| Collaboration | groups | ◐ | Wallet Group Sharing: one group per owner (can be member of others), per-account permissions (admin / track & read / read only / no access); members switch between person… | S43, S42 |
| Collaboration | invitations / participants without accounts | ◐ | Wallet group members are invited by the email registered in Wallet, so they need a Wallet account (free is enough; only the owner needs Premium). | S43, S42 |
| Collaboration | household / partner shared finances | ● | Group Sharing shares the owner's accounts (including bank-synced ones) with partner/family; shopping lists shareable (Android). Owner needs Premium. | S43 |
| Collaboration | debt simplification | ◐ | ShareCost computes the fewest settle-up payments; not a Wallet feature. | S42 |
| Automation | Apple Pay capture automation | ● | Shortcuts 'Transaction' automation runs immediately and posts to a manual account (see Capture). | S8 |
| Automation | Mercado Pago sync | ? (was ○) | No Mercado Pago mention on bank-sync, AISP or help pages; coverage described as Europe, North America 'and beyond' with named EU/UK/US banks only. · 2nd reader: No official page mentions Mercado Pago, Argentina or Latin America for bank sync (bank-sync page names only US/UK/EU banks and PayPal; AISP page says… | S44, S45, S46 |
| Automation | bank sync (aggregator/open banking) | ● | Premium. BudgetBakers is itself a licensed PSD2 AISP (Czech National Bank) and markets '15,000+' institutions (older store copy says 4,000); read-only; auto refresh once… | S44, S47, S48 |
| Automation | imports (generic) | ● | Web app only (iOS/Android just link to it): CSV, XLS/XLSX, OFX; column mapping; General (manual) accounts only; ~1,000 rows recommended; imports can be deleted as a batch… | S11 |
| Automation | CSV import/export | ● | CSV import on web; CSV export on web (Premium) and Android (CSV/XLS/PDF); export not available on iOS. | S11, S49 |
| Automation | Excel import/export | ● | XLS/XLSX import and XLS export (export is Premium, web/Android). | S49 |
| Automation | JSON import/export | ○ | Supported formats are listed as CSV, XLS/XLSX and OFX for import and CSV/XLS/PDF for export; JSON is only reachable via the REST API beta. | S11, S13 |
| Automation | notification-based automation (reading bank/payment notifications) | ◐ | Android only: 'Pay & Track' reads Google Pay (Google Wallet) notifications, parses merchant/amount/currency locally into a dedicated manual account; opt-in; Argentina and… | S50, S51 |
| Automation | recurring detection | ◐ | Feature page claims the app recognises spending patterns and suggests recurring payments; help centre only documents manual conversion of records into planned payments an… | S31, S28 |
| Privacy / Platform | local-first / on-device data | ○ | Cloud-first: data syncs to BudgetBakers servers on AWS; the web app mirrors the server; data entered in offline mode is not backed up and cannot be recovered; auto-logout… · 2nd reader: Confirmed cloud-first (AWS hosting; offline-mode data is not backed up and cannot be recovered; all devices must be online to save). | S52, S53, S54, S55, S56 |
| Privacy / Platform | account required or not | ● (● = account required) | Account required: sign up with Google, Facebook, Apple or email; mandatory email verification blocks app access until done. | S34, S54 |
| Privacy / Platform | cloud sync | ● | Own cloud sync across iOS, Android and web (all devices must be online to save; offline multi-device use can duplicate planned payments). | S57, S58 |
| Privacy / Platform | iCloud / CloudKit | ○ | Sync is via BudgetBakers' own AWS-hosted backend, not iCloud. | S53 |
| Privacy / Platform | Face ID / app lock | ● | Face ID / fingerprint and PIN lock on iOS and Android; not on web. | S59, S60 |
| Privacy / Platform | hidden amounts (privacy mode) | ◐ | 'Hide Amounts' toggle exists on Android only (resets on restart); marked Not available on iOS and web. | S61 |
| Privacy / Platform | Apple Watch | ○ | No watchOS device appears in the App Store supported-device list and no Watch mention on the listing or help centre. | S62, S9 |
| Privacy / Platform | widgets | ? | See Capture: only in-app dashboard 'widgets' are documented; no iOS Home/Lock Screen widget evidence. | S12 |
| Privacy / Platform | accessibility (VoiceOver, Dynamic Type) evidence | ? | No accessibility statements found on the listing, site or help centre. | — |
| Privacy / Platform | localization (languages, regions) | ● | 48 App Store languages (incl. Spanish, Portuguese, Arabic, Hindi, Chinese, Vietnamese...); mobile language follows the phone's language; web language is selectable; compa… | S62, S63, S64 |
| Privacy / Platform | Android availability | ● | Google Play, 10M+ downloads, 4.8 rating, updated 2026-09-30; Android is the original and most feature-complete platform (debts, goals, split, saved filters, shopping list… | S65, S66 |
| Privacy / Platform | web availability | ● | web.budgetbakers.com included with the account; has imports, export, bulk ops, analytics; lacks budgets, group sharing, goals, debts, biometrics. | S58, S18 |
| Monetization | free tier and its limits | ◐ | Free = manual tracking, basic reports, limited accounts (premium is 'unlimited accounts'; the exact free account cap is not stated on official pages), some dashboard char… | S66, S67, S34 |
| Monetization | trial | ● | A free Premium Trial exists and auto-converts to a paid subscription unless cancelled; length not stated. | S66 |
| Monetization | monthly price | ◐ | App Store IAP list does not label durations. US storefront: 'Premium' $5.99, $14.99, $24.99, $29.99; AR storefront (priced in USD): 'Premium' USD 4.99, 14.99, 24.99, 24.9… | S9, S68, S69 |
| Monetization | annual price | ◐ | Unlabelled; the $24.99-$29.99 (US) / USD 24.99 (AR) 'Premium' entries are the plausible yearly plan (stale store text cites EUR 14.99/year). · 2nd reader: IAP entries re-read and match the audit (unlabelled). Note correction: the Google Play ARS range 'ARS 807.30 - ARS 209,300 per item' appears on the AR… | S9, S68, S65 |
| Monetization | lifetime price | ● | 'Lifetime Premium' $29.99 on US storefront, USD 24.99 on AR storefront; also a '3-Year Premium' at $49.99 / USD 49.99 (the listing order suggests the lifetime SKU may be… | S9, S68 |
| Monetization | what Pro gates (the meaningful boundary) | ● | Premium gates bank sync (the core promise), unlimited accounts, investments, data export, creating a sharing group, label colours, some dashboard charts, REST API and MCP… | S66, S43, S70, S49 |
| Future Finance | savings goals | ◐ | Android only (see Goals); iOS and web not available. | S40 |
| Future Finance | investments | ● | Premium investment accounts for stocks/ETFs with daily price updates, crypto, and since 5.3 (2026-03-12) 'Other' assets with manual prices; buy/sell records, fantasy port… · 2nd reader: Confirmed Premium stocks/ETF tracking with daily prices, fantasy portfolios, exclude from stats. Nuance added: cryptocurrencies are available only on… | S70, S71, S9, S72, S73 |
| Future Finance | net worth | ● | Marketed net-worth tracking across accounts, investments and assets; overall balance includes all non-excluded accounts. | S67, S25 |
| Future Finance | loans / mortgages | ◐ | Mortgage/loan account types (manual, no bank sync for mortgages) tracked via transfers or balance adjustments; no amortisation/interest schedule; personal debts module An… | S74, S32 |
| Future Finance | assets (property, vehicles) | ◐ (was ●) | 'Other' investment asset type with manual price update intended for real estate, collectibles, etc. (iOS 5.3). · 2nd reader: The iOS 5.3 (Mar 12) release note does say a new 'Other' investment asset type with manual price update suitable for real estate, collectibles or anyt… | S9, S75, S72 |
| Organization | record status / reconciliation flags (added) | ● | Records carry a Status (Reconciled, Cleared, Uncleared, Voided) usable in filters; a separate 'record confirmation' green check mark on Android/iOS distinguishes reviewed… | S76, S77 |
| Organization | warranty tracking (added) | ● | A Warranty field is listed among the optional record details on Android and iOS (alongside receipts, location, payee); a dedicated 'Warranties' help article exists (id 70… | S78 |
| Reporting | exclude accounts / categories from statistics (added) | ● | Per-account 'Exclude from statistics' toggle, per-category 'Show' toggle to hide a category from charts (documented workaround to hide individual records), transfers excl… | S79 |
| Spending / Money | account balance limit alerts (added) | ● | iOS 5.3 (Mar 12) added in-app notifications when an account balance crosses a limit set in the account settings. | S75 |
| Collaboration | shopping lists (added) | ◐ | Android only (iOS and web 'not available'): item lists with prices, tick-off, create records from items (manual accounts only), share via messages or Group Sharing. | S80 |
| Privacy / Platform | sign-in methods (added) | ● | Google, Facebook, email (passwordless since 4.9 / improved in 5.7) and Sign in with Apple on iOS; mandatory email verification blocks access until done. | S36, S56, S75 |

Sources:

- S1: https://support.budgetbakers.com/hc/en-us/articles/7149271363090-Everything-About-Transactions-Add-edit-clone-split-duplicates
- S2: https://support.budgetbakers.com/hc/en-us/articles/7077050225042-Using-Templates
- S3: https://support.budgetbakers.com/hc/en-us/articles/34453128217618-Adding-an-Account
- S4: https://support.budgetbakers.com/api/v2/help_center/en-us/articles.json
- S5: https://budgetbakers.com/en/products/wallet/integrations/mcp/
- S6: https://support.budgetbakers.com/hc/en-us/articles/7077082048146-All-about-Categories-and-Subcategories
- S7: https://support.budgetbakers.com/hc/en-us/articles/7149319175826-Automatic-Rules
- S8: https://support.budgetbakers.com/hc/en-us/articles/26593713953554-Apple-Pay-Integration
- S9: https://apps.apple.com/us/app/wallet-daily-budget-profit/id1032467659
- S10: https://support.budgetbakers.com/hc/en-us/articles/12212428113810-What-is-the-Wallet-app
- S11: https://support.budgetbakers.com/hc/en-us/articles/7077275632274-Import-your-transactions-or-files
- S12: https://support.budgetbakers.com/hc/en-us/articles/7150077480850-Add-or-Modify-Dashboard-Cards-Widgets
- S13: https://support.budgetbakers.com/hc/en-us/articles/10761479741586-Rest-API-MCP
- S14: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/26593713953554.json
- S15: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/10761479741586.json
- S16: https://support.budgetbakers.com/hc/en-us/articles/7076564578066-Utilising-Labels
- S17: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/7076564578066.json
- S18: https://support.budgetbakers.com/hc/en-us/articles/7076953735314-Setup-Budgets
- S19: https://support.budgetbakers.com/hc/en-us/articles/7076754432146-Working-with-Filters
- S20: https://support.budgetbakers.com/hc/en-us/articles/11224785367826-Missing-Merchant-Details
- S21: https://support.budgetbakers.com/hc/en-us/articles/26911037277586-OCR
- S22: https://support.budgetbakers.com/hc/en-us/articles/6950259945362-Adding-a-Credit-Card
- S23: https://support.budgetbakers.com/hc/en-us/articles/7148318384530-Overdraft-Account-Types
- S24: https://feedback.budgetbakers.com/
- S25: https://support.budgetbakers.com/hc/en-us/articles/36544649033618-How-to-exclude-an-account-records-or-transfers-from-your-statistics
- S26: https://support.budgetbakers.com/hc/en-us/articles/31001090941970-Understanding-Your-Wallet-Statistics
- S27: https://support.budgetbakers.com/hc/en-us/articles/7149523920786-Setup-Planned-Payments
- S28: https://support.budgetbakers.com/hc/en-us/articles/7184048333842-Planned-Transfers
- S29: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/7149523920786.json
- S30: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/7184048333842.json
- S31: https://budgetbakers.com/en/products/wallet/features/planned-payments/
- S32: https://support.budgetbakers.com/hc/en-us/articles/7149520322706-Setting-up-Debts-and-Loans
- S33: https://support.budgetbakers.com/hc/en-us/articles/7149418777746-Multiple-Currencies-Exchange-Rates
- S34: https://support.budgetbakers.com/hc/en-us/articles/7151352625938-Getting-Started-with-Wallet
- S35: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/7149418777746.json
- S36: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/7151352625938.json
- S37: https://support.budgetbakers.com/hc/en-us/articles/36546774821778-What-does-the-percentage-next-to-Income-Expenses-mean
- S38: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/7076953735314.json
- S39: https://budgetbakers.com/en/products/wallet/features/budgets/
- S40: https://support.budgetbakers.com/hc/en-us/articles/7181571852690-Setting-up-Goals
- S41: https://support.budgetbakers.com/hc/en-us/articles/12212663489298-Setup-Initial-day-of-the-month
- S42: https://budgetbakers.com/en/products/sharecost/
- S43: https://support.budgetbakers.com/hc/en-us/articles/7149394922002-Everything-about-Group-Sharing
- S44: https://budgetbakers.com/en/products/wallet/features/bank-sync/
- S45: https://budgetbakers.com/en/products/aisp-open-banking/
- S46: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/7182879110290.json
- S47: https://support.budgetbakers.com/hc/en-us/articles/7152012249618-How-often-does-my-bank-account-data-update
- S48: https://support.budgetbakers.com/hc/en-us/articles/7182879110290-Is-it-safe-to-connect-my-bank-account-with-Wallet
- S49: https://support.budgetbakers.com/hc/en-us/articles/7151606064018-How-to-export-transactions-from-Wallet
- S50: https://support.budgetbakers.com/hc/en-us/articles/27454807191058-Google-Pay-Integration
- S51: https://support.budgetbakers.com/hc/en-us/articles/27357560590098-Notification-Access-Permission
- S52: https://support.budgetbakers.com/hc/en-us/articles/10105401036690-Backup-Measures-and-Data-Loss
- S53: https://budgetbakers.com/en/security/
- S54: https://support.budgetbakers.com/hc/en-us/articles/27741215736722-Account-Security-Mandatory-Email-Verification
- S55: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/10105401036690.json
- S56: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/27741215736722.json
- S57: https://support.budgetbakers.com/hc/en-us/articles/7183819864850-Data-not-syncing-between-devices
- S58: https://support.budgetbakers.com/hc/en-us/articles/7181432342034-Wallet-Web-App
- S59: https://support.budgetbakers.com/hc/en-us/articles/7181476227474-Setup-Fingerprint-or-Face-ID-recognition
- S60: https://support.budgetbakers.com/hc/en-us/articles/14905550660754-Enable-Change-or-Reset-your-PIN
- S61: https://support.budgetbakers.com/hc/en-us/articles/7184052562578-Hide-Account-Balance
- S62: https://itunes.apple.com/lookup?id=1032467659&country=us
- S63: https://support.budgetbakers.com/hc/en-us/articles/12212009575442-How-to-change-the-app-language
- S64: https://budgetbakers.com/
- S65: https://play.google.com/store/apps/details?id=com.droid4you.application.wallet&hl=en&gl=AR
- S66: https://support.budgetbakers.com/hc/en-us/articles/7151349344018-Everything-about-Premium
- S67: https://budgetbakers.com/en/products/wallet/
- S68: https://apps.apple.com/ar/app/wallet-daily-budget-profit/id1032467659
- S69: https://itunes.apple.com/lookup?id=1032467659&country=ar
- S70: https://support.budgetbakers.com/hc/en-us/articles/14785418453522-Investments-Stocks-ETF
- S71: https://support.budgetbakers.com/hc/en-us/articles/12211695770130-Crypto-Support
- S72: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/14785418453522.json
- S73: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/12211695770130.json
- S74: https://support.budgetbakers.com/hc/en-us/articles/16543490978194-Mortgage-How-to-effectively-manage-it-in-Wallet
- S75: https://apps.apple.com/us/app/wallet-daily-budget-profit/id1032467659?see-all=version-history
- S76: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/7076754432146.json
- S77: https://support.budgetbakers.com/api/v2/help_center/en-us/articles.json?per_page=100&page=1
- S78: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/7149271363090.json
- S79: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/36544649033618.json
- S80: https://support.budgetbakers.com/api/v2/help_center/en-us/articles/7151701340050.json
- S81: https://budgetbakers.com/en/products/wallet/download/
- S82: https://budgetbakers.com/en/products/wallet/features/
- S83: https://budgetbakers.com/en/support/
- S84: https://budgetbakers.com/en/pricing/
- S85: https://support.budgetbakers.com/hc/en-us/articles/7183726011538-How-many-transactions-will-appear-in-Wallet-when-I-first-connect-to-my-bank
- S86: https://support.budgetbakers.com/hc/en-us/articles/7076796545554-Connect-disconnect-or-reconnect-your-bank
- S87: https://support.budgetbakers.com/hc/en-us/articles/7150530312722-I-cannot-connect-my-bank-account
- S88: https://support.budgetbakers.com/hc/en-us/articles/7150175717138-Bank-is-missing-Bank-is-not-listed
- S89: https://support.budgetbakers.com/hc/en-us/articles/7151701340050-Shopping-List
- S90: https://support.budgetbakers.com/hc/en-us/articles/7077030698386-Warranties
- S91: https://support.budgetbakers.com/hc/en-us/articles/7002928224786-Clone-Transactions
- S92: https://support.budgetbakers.com/hc/en-us/articles/7150568033938-Bulk-Edit-Records
- S93: https://support.budgetbakers.com/hc/en-us/articles/9740038391186-Record-Confirmation-Green-check-mark
- S94: https://support.budgetbakers.com/hc/en-us/articles/7148334559762-Bank-Transfers
- S95: https://support.budgetbakers.com/hc/en-us/articles/7149421504146-Uncleared-Records
- S96: https://support.budgetbakers.com/hc/en-us/articles/34607304316562-Printing-Your-Reports-and-Transactions
- S97: https://support.budgetbakers.com/hc/en-us/articles/28215376280466-Why-isn-t-an-asset-purchase-stocks-ETFs-cryptocurrencies-reflected-as-an-expense-in-Wallet

## Piggy

Product as audited: Piggy: Gastos Diarios (App Store title; subtitle "Dividir cuentas con amigos"; Google Play title "Piggy: Organizador de gastos"; package com.eraia). Official site: https://piggy.com.ar/. Second reader's overall confidence: high.

Could not verify: Live Activity / Dynamic Island: no mention anywhere; Home-screen Quick Actions; iOS Home/Lock Screen widgets as distinct from in-app dashboard widgets (listing copy ambiguous); In-app voice capture and multi-movement parsing of a single voice note/message; Tags, subcategories, search, receipt attachment retention; Face ID / app lock and hidden-amount mode; Apple Watch support today (only in old release notes); Fiat exchange-rate source for the unified balance (blue/MEP/oficial claimed in marketing, not in help) and his…; Self-service CSV/Excel/JSON export; Refund handling; Calendar views and custom report date ranges; Pro Max in-app purchase on the App Store (only Semanal/Mensual/Anual listed) and ARS vs USD storefront pricing…; https://piggy.com.ar/integraciones/apple-pay/ and /integraciones/ripio/ returned 404 (content lives at /blog/t…; Google Play page fetched via curl only; WebFetch truncated it.

| Group | Capability | Status | What the source says | Sources |
| --- | --- | --- | --- | --- |
| Capture | manual entry | ● | Central + button: amount, category, wallet/card, date, description; expense, income and transfer-between-accounts types; drafts vs confirmed states; edit any time. | S1, S2 |
| Capture | voice capture | ◐ | Voice notes are accepted by the WhatsApp bot (transcribed via OpenAI/Google per privacy policy) and turned into a reviewable draft. | S3, S4 |
| Capture | multi-entry voice (several movements in one utterance) | ? | Batch creation is documented only for PDF statements and CSV files sent over WhatsApp (bot detects multiple movements for review). | S3, S5 |
| Capture | AI categorization | ● | WhatsApp/OCR drafts arrive with an automatic category and contextual description; user reviews before saving. Provider: OpenAI and Google per privacy policy. | S6, S4 |
| Capture | Apple Pay / Wallet Shortcut capture | ● | User builds a Shortcuts automation on the Wallet transaction trigger and adds Piggy's own Shortcuts action ('Guardar compra en Piggy'), mapping merchant and amount. | S7, S8 |
| Capture | Dynamic Island / Live Activity | ? | No mention on the listing, the integrations page, the Apple Pay help article or the tutorial. | S9, S7 |
| Capture | WhatsApp / messaging capture | ● | Official WhatsApp number linked to the account (provider Kapso). Accepts text, voice notes, receipt photos, PDF bank/card statements and CSV; bot proposes movements, user… | S3, S10, S4 |
| Capture | widgets (Home/Lock Screen) | ◐ | App Store copy says 'Atajos de iOS, Apple Wallet y widgets' to record movements in fewer steps (old notes said 'Widgets de iOS'). | S11, S12 |
| Capture | Quick Actions (home-screen long-press) | ? | Not mentioned anywhere read. | — |
| Capture | external integrations / Shortcuts / App Intents | ● | Piggy exposes a Shortcuts action (used by the Wallet automation); integrations hub lists WhatsApp, Mercado Pago, Ripio, ChatGPT, Claude, Gemini (MCP), Apple Wallet/Shortc… | S9, S13 |
| Organization | categories | ● | Category per movement, emoji-style categories, reports by category. | S1 |
| Organization | custom categories | ● | Create/edit categories; free plan capped at 15 custom categories, Pro/Pro Max unlimited. | S10, S14 |
| Organization | tags | ? | Not mentioned in help or listing. | — |
| Organization | subcategories | ? | Not mentioned. | — |
| Organization | search | ? | Listing promises a 'clear, filterable' history; search itself not documented. · 2nd reader: Kept. The only 'search' mentions are searching phone contacts inside the split flow and the pricing FAQ saying the MCP connection lets an AI 'buscar t… | S11, S10, S15 |
| Organization | filters | ◐ | Old listing copy describes a filterable movement list; no detail on filter dimensions. | S11 |
| Organization | merchant intelligence (normalisation, logos, rules) | ◐ | Merchant ('comercio') is extracted from receipts/Wallet and reports and AI queries can group by merchant; no logos, normalisation or user rules documented. | S6, S16 |
| Organization | notes | ● | Optional note/description field on transactions. | S11 |
| Organization | attachments / receipts | ◐ | Receipt photos are read by OCR through WhatsApp to create the expense; whether the image stays attached to the movement is not documented. No in-app camera documented. · 2nd reader: Kept. Privacy policy adds that receipt images and audio sent for OCR/transcription are deleted from processing servers after extraction 'unless you re… | S6, S4, S17 |
| Spending / Money | accounts | ● | Wallets for cash, bank, virtual wallets, credit cards, crypto; one currency per wallet; name/icon; balance adjustments; transfers between wallets. | S18, S10 |
| Spending / Money | credit cards | ● | Card is a wallet type with closing and due day; purchases allocated to the cycle by closing date; cycle closing day can be shifted per cycle for holidays; card detail sho… | S19 |
| Spending / Money | statement cycles (closing/due dates) | ● | Per-card cierre and vencimiento; purchases on/before closing go to current statement, after it to the next; statement payment recorded as a transfer; unpaid remainder rol… | S19, S20 |
| Spending / Money | installments (cuotas) | ● | Selecting a card wallet enables cuotas: total, number of cuotas, first-cuota date; first cuota counts in the current period, the rest are scheduled and only hit expenses/… | S21, S22, S23 |
| Spending / Money | refunds | ? | No refund/reembolso flow documented; transaction types are expense, income, transfer. | S2 |
| Spending / Money | early installment payoff | ● | Plan view offers an early-cancellation option that marks remaining cuotas as settled in the current month. | S21 |
| Spending / Money | recurring expenses | ● | 'Movimientos fijos' templates (weekly/monthly/annual, custom repetition) auto-generate the movement on the date; catch-up when app is opened late; Free 10, Pro 30, Pro Ma… | S24, S10 |
| Spending / Money | subscriptions | ● | Subscription tracking (added 1.1.22): pre-due reminders, annualised cost per subscription, cancellation links, monthly fixed-cost dashboard. | S25, S11 |
| Spending / Money | debts / receivables (personal loans) | ◐ | Per-contact balances from shared expenses ('who owes me / whom the researcher owe'), partial settlements and forgiveness; no standalone personal-loan object documented. | S26, S27 |
| Spending / Money | multiple currencies | ● | All ISO 4217 fiat, major crypto and stablecoins; one currency per wallet; primary currency chosen at onboarding; cross-currency transfers since 1.1.21. | S28, S29 |
| Spending / Money | FX semantics | ◐ | Original currency is kept: each wallet holds its own currency and amounts are stored as entered. Dollar buy/sell is a transfer where the user types both debited and credi… | S30, S31, S32, S33 |
| Spending / Money | cash flow view | ◐ | Monthly balance (income, expenses, remaining) with month navigation and a 'balance & net impact' widget; no dedicated cash-flow chart documented. | S34, S12 |
| Spending / Money | future commitments / upcoming payments | ● | 'Agenda / Cuotas' section, navigation to future months, 'projected expenses' widget combining cuotas and recurring items, due-date reminders. | S22, S12 |
| Budgeting / Planning | total budget | ○ | Help FAQ states spending objectives are configured per specific category; overall spending is only visible in analytics. | S35 |
| Budgeting / Planning | category budgets | ● | Monthly limit per category with daily allowance, progress, history, auto-renew; shared expenses count only the user's share. | S36, S35 |
| Budgeting / Planning | goals | ◐ | Pricing table lists goals (3 free / 10 Pro / unlimited), but the help FAQ says the savings-goals tab is still in development; listing 1.1.24 says 'objetivos y presupuesto… | S35, S14 |
| Budgeting / Planning | flexible vs fixed budgets / rollover | ○ | Counter resets to zero each month; no rollover. | S35 |
| Budgeting / Planning | pay-cycle periods (custom month start) | ○ | Objectives run on calendar months (1st to last day); no custom start day documented for budgets or the monthly balance. | S35 |
| Budgeting / Planning | calendar view | ? | Agenda section for cuotas exists; no calendar grid documented. | S22 |
| Budgeting / Planning | projections / forecasts | ● | Future months show scheduled cuotas and recurring items; projected-expenses widget; AI assistants can project month-end and next card payment. | S22, S37 |
| Budgeting / Planning | reminders | ● | 'Recordatorios inteligentes' since 1.1.21; pre-due subscription notifications; card due reminders in listing copy. · 2nd reader: Confirmed, with a refinement: the pricing matrix row 'Recordatorios de pago' (card and subscription due dates) is 'App' on the free plan and 'App + Wh… | S11, S25, S10, S4 |
| Reporting | by category | ● | Category breakdown widgets and charts. | S12 |
| Reporting | daily | ● | Spending widget shows daily evolution within the period. | S12 |
| Reporting | trends over time | ◐ | Daily evolution and period comparison widgets; multi-month trend chart not explicitly documented. | S12 |
| Reporting | period comparisons | ● | Period-comparison widget with percentage change vs prior period. | S12 |
| Reporting | by merchant | ◐ | Homepage promises spending by category, merchant and period; help lists no merchant widget, but AI prompts cover top merchants. | S38, S16 |
| Reporting | subscriptions report | ● | Dashboard with monthly fixed total, per-subscription amounts, dates and annual projection. | S25 |
| Reporting | calendar report | ? | Not documented. | — |
| Reporting | custom date ranges | ? | Widgets reference 'the selected range' without specifying custom ranges. | S12 |
| Reporting | AI-generated reports | ◐ | No in-app AI report; analysis is delegated to external assistants through MCP (read-only). | S39 |
| Reporting | explain / query financial data in natural language | ● | MCP server at app.piggy.com.ar/mcp for ChatGPT (developer mode), Claude (connectors) and Gemini; OAuth via Google/Apple; read-only structured data; 10 queries/month free,… | S37, S39, S10 |
| Collaboration | split expenses | ● | Split a movement with phone contacts; only the user's share counts as real expense, the rest is a receivable. | S15, S40 |
| Collaboration | equal split | ● | Equal mode listed. | S15 |
| Collaboration | percentage split | ● | Percentage mode listed. | S15 |
| Collaboration | share-based split | ○ | Help lists only equal, percentage and exact modes. | S15 |
| Collaboration | exact-amount split | ● | Exact mode listed. | S15 |
| Collaboration | groups | ◐ | Help says group creation is not yet part of the split flow (select contacts individually); pricing table nevertheless lists 'grupos' limits and travel passes (1/yr Pro, 3… · 2nd reader: Status kept, note corrected with exact figures: the pricing matrix row 'Grupos compartidos' reads 2 (free) / 5 (Pro) / unlimited (Pro Max), and the ma… | S15, S10, S40 |
| Collaboration | invitations / participants without accounts | ● | Participants are phone contacts and need not install Piggy; WhatsApp summaries can be sent as reminders. | S40, S41 |
| Collaboration | household / partner shared finances | ◐ | Marketed for couples and households but implemented as contact-level splits; no shared ledger between two accounts documented. | S40 |
| Collaboration | debt simplification | ○ | Balances are bilateral per contact; the Splitwise comparison credits simplification to Splitwise, not Piggy. | S41, S27 |
| Automation | Apple Pay capture automation | ● | Shortcuts Wallet-transaction automation -> Piggy pending entry (merchant, amount) -> manual accept. | S7 |
| Automation | Mercado Pago sync | ● | Read-only OAuth authorisation on Mercado Pago (Argentina); imports expenses/payments, income, QR, transfers and internal reserve moves for the last 30 days then continuou… · 2nd reader: Confirmed. Help says the sync re-queries when the app is opened/refreshed and also when Piggy receives a new compatible payment/collection notificatio… | S42, S43, S40 |
| Automation | bank sync (aggregator/open banking) | ○ | Only Mercado Pago and Ripio are connected; banks are handled by sending PDF/CSV statements over WhatsApp. Site states Piggy stores no bank credentials. | S9, S44 |
| Automation | imports (generic) | ● | PDF bank/card statements and CSV via WhatsApp; detects purchases, cuotas and taxes and assigns them to the cycle; Pro 3 files/month, Pro Max unlimited, none on free. | S44, S10 |
| Automation | CSV import/export | ◐ | CSV import via WhatsApp (Pro). Export: security page says users can request an export of their account/records through the app or support; no CSV self-service export docu… | S3, S17 |
| Automation | Excel import/export | ? | Not documented (site only offers a downloadable Excel template as a lead magnet). | S45 |
| Automation | JSON import/export | ? | Not mentioned. | — |
| Automation | notification-based automation | ○ | Capture paths are Shortcuts, WhatsApp and OAuth sync; nothing reads bank/payment push notifications (and Android listing does not claim it). | S9 |
| Automation | recurring detection | ? | Subscriptions are user-created templates; automatic detection from synced movements not documented. | S24 |
| Privacy / Platform | local-first / on-device data | ○ | Cloud service: data stored on Piggy servers (AES-256 at rest, TLS 1.3), AI processing by OpenAI/Google outside Argentina; Wallet captures are 'local pending' only until a… | S4, S17 |
| Privacy / Platform | account required or not | ● (● = account required) | Account required: Google, Apple Sign-In or email/WhatsApp OTP; privacy policy requires name, surname, email, photo. | S17, S4 |
| Privacy / Platform | cloud sync | ● | Server-side account, multi-channel (app, WhatsApp, MCP) access to the same data. | S4 |
| Privacy / Platform | iCloud / CloudKit | ○ | Own backend; no iCloud mention anywhere. | S4 |
| Privacy / Platform | Face ID / app lock | ● (was ?) | Security page covers sign-in and encryption only. · 2nd reader: The App Store version history (AR storefront), version 1.0.5 dated 26 Nov 2025, states that biometric sign-in with fingerprint and Face ID was enabled… | S17, S11 |
| Privacy / Platform | hidden amounts (privacy mode) | ? | Not documented. | S17 |
| Privacy / Platform | Apple Watch | ? | Release notes 1.1.16/1.1.17 claimed an iPhone + Apple Watch experience; the current listing is 'Sólo para iPhone' with no Watch compatibility line. · 2nd reader: Re-confirmed: the only Apple Watch mention is in the 1.1.15 (16 May 2026) and 1.1.16 (5 Jun 2026) release-note bodies, which are a pasted description… | S11 |
| Privacy / Platform | widgets | ◐ | See CAPTURE widgets: in-app dashboard widgets confirmed; iOS Home/Lock Screen widgets claimed in listing copy only. | S12 |
| Privacy / Platform | accessibility (VoiceOver, Dynamic Type) evidence | ○ | App Store accessibility section: developer has not yet indicated supported accessibility features. · 2nd reader: Confirmed verbatim in the listing's accessibility section: the developer has not yet indicated which accessibility features the app supports. | S11 |
| Privacy / Platform | localization (languages, regions) | ◐ | App Store: Spanish only. Google Play: Spanish (Latin America) and English (US). Content targets Argentina, with Uruguay guides. | S11, S46 |
| Privacy / Platform | Android availability | ● | Google Play 'Piggy: Organizador de gastos' (com.eraia) by Tomy Altman, v1.0.23, updated 13 Sep 2026, 100+ downloads, 5.0 (16 reviews), IAP ARS 7,460.05 to ARS 74,735.05 p… | S46 |
| Privacy / Platform | web availability | ○ | No web app offered; llms.txt says no public API; comparisons describe mobile app plus WhatsApp/MCP channels. | S13, S47 |
| Monetization | free tier and its limits | ● | Free forever: unlimited manual movements; 15 custom categories; 6-month history; 5 wallets; 10 recurring; 3 goals; 10 WhatsApp uploads/month; 10 MCP queries/month; 3 dash… | S10, S14 |
| Monetization | trial | ○ | Pricing page: free plan is perpetual, no trial mentioned. | S10 |
| Monetization | monthly price | ● | App Store (AR and US storefronts, shown in USD): Piggy Pro Semanal USD 1.99, Piggy Pro Mensual USD 4.99. Pricing page: Pro USD 4.99/month, Pro Max USD 10.99/month; curren… | S11, S10, S46 |
| Monetization | annual price | ● | App Store: Piggy Pro Anual USD 49.99. Pricing page: Pro USD 49.90/yr (USD 4.16/mo), Pro Max USD 109.90/yr (USD 9.16/mo). Pro Max does not appear in the App Store IAP list… | S11, S10 |
| Monetization | lifetime price | ○ | No lifetime option on pricing page or IAP list. | S10 |
| Monetization | what Pro gates | ● | Volume and automation: history beyond 6 months, unlimited categories, more wallets (10 / unlimited), recurring (30 / unlimited), goals (10 / unlimited), WhatsApp 150 / un… · 2nd reader: Confirmed, with additions from the pricing matrix: Pro Max also gets 'Cargar movimientos por mail' (forward receipts/invoices by email), 'Widgets avan… | S14, S10 |
| Future Finance | savings goals | ◐ | Listed in plan limits and 1.1.24 notes, but help says the savings-goals tab is still in active development. | S35 |
| Future Finance | investments | ◐ | Ripio connection creates one wallet per coin with balances and movements; crypto valued at market quotes in the unified total. No stocks/bonds/funds. | S48, S28 |
| Future Finance | net worth | ◐ | Unified balance across wallets converted to primary currency ('Saldo Unificado'); liabilities limited to card balances; no net-worth history documented. | S29, S49 |
| Future Finance | loans / mortgages | ○ | Not in wallet types or help; only card debt and contact balances. | S18 |
| Future Finance | assets (property, vehicles) | ○ | No asset wallet type; wallets are cash, bank, virtual, card, crypto. | S18 |
| Capture | email capture (forward receipts/statements by email) (added) | ◐ | Pricing matrix row 'Cargar movimientos por mail: reenviá comprobantes o facturas por correo' is marked available on Pro Max only (not free, not Pro). | S10, S4 |
| Budgeting / Planning | budget history / archive (added) | ● | Help article: a spending objective's monthly cap can be edited, previous periods' history can be consulted from the objective detail, and archiving keeps the current peri… | S50, S36 |
| Automation | auto-settle shared debts from Mercado Pago transfers (added) | ● | Pro feature: when an incoming Mercado Pago transfer arrives from a saved contact, Piggy detects it, notifies the user and suggests settling the linked debt in one tap. | S40 |
| Monetization | travel pass (temporary Pro for a group) (added) | ● | Pricing FAQ: the 'Pase de viaje' lets the buyer share all Pro benefits with the members of a shared group for 30 days at no extra cost to them; 1 per year on Pro, 3 per y… | S10 |
| Spending / Money | shared expense analytics (total vs real spend) (added) | ● | Help distinguishes 'gasto total' (what left your wallet), 'gasto compartido' (parts assigned to contacts) and 'gasto real' (your own consumption); analytics and objective… | S51 |
| Privacy / Platform | Google Gemini MCP connector (added) | ● | Dedicated integration page for Google Gemini using the same MCP server URL (app.piggy.com.ar/mcp); read-only analytical queries; MCP query quotas 10/50/unlimited per plan… | S52, S10 |

Sources:

- S1: https://piggy.com.ar/ayuda/primeros-pasos/como-empezar-en-piggy/
- S2: https://piggy.com.ar/ayuda/gastos-e-ingresos/como-se-calculan-gastos/
- S3: https://piggy.com.ar/integraciones/whatsapp/
- S4: https://piggy.com.ar/privacy.html
- S5: https://piggy.com.ar/ayuda/whatsapp/cargar-gasto-por-whatsapp/
- S6: https://piggy.com.ar/foto-ticket/
- S7: https://piggy.com.ar/ayuda/integraciones/configurar-apple-pay-con-atajos/
- S8: https://piggy.com.ar/blog/tutorial-apple-wallet.html
- S9: https://piggy.com.ar/integraciones/
- S10: https://piggy.com.ar/precios/
- S11: https://apps.apple.com/ar/app/piggy-control-de-gastos/id6740286427
- S12: https://piggy.com.ar/ayuda/primeros-pasos/como-personalizar-pantalla-estadisticas-con-widgets/
- S13: https://piggy.com.ar/llms.txt
- S14: https://piggy.com.ar/ayuda/piggy-pro/
- S15: https://piggy.com.ar/ayuda/gastos-compartidos/como-registrar-y-dividir-un-gasto/
- S16: https://piggy.com.ar/ayuda/integraciones/prompts-y-consultas-ia/
- S17: https://piggy.com.ar/ayuda/seguridad/
- S18: https://piggy.com.ar/ayuda/billeteras/
- S19: https://piggy.com.ar/ayuda/tarjetas-de-credito/configurar-cierre-y-vencimiento/
- S20: https://piggy.com.ar/ayuda/tarjetas-de-credito/como-pagar-el-resumen-de-tarjeta/
- S21: https://piggy.com.ar/ayuda/cuotas/como-registrar-compras-en-cuotas/
- S22: https://piggy.com.ar/ayuda/cuotas/impacto-de-cuotas-en-meses-futuros/
- S23: https://piggy.com.ar/ayuda/cuotas/que-pasa-si-elimino-una-compra-en-cuotas/
- S24: https://piggy.com.ar/ayuda/pagos-recurrentes/como-funcionan-los-pagos-recurrentes/
- S25: https://piggy.com.ar/suscripciones/
- S26: https://piggy.com.ar/ayuda/gastos-compartidos/como-saldar-o-perdonar-una-deuda/
- S27: https://piggy.com.ar/ayuda/gastos-compartidos/como-se-calculan-los-saldos/
- S28: https://piggy.com.ar/ayuda/monedas/que-monedas-soporta-piggy/
- S29: https://piggy.com.ar/ayuda/billeteras/como-funcionan-las-monedas/
- S30: https://piggy.com.ar/ayuda/monedas/operaciones-multimoneda-y-cambio-de-divisas/
- S31: https://piggy.com.ar/ayuda/billeteras/compra-venta-dolares/
- S32: https://piggy.com.ar/ayuda/tarjetas-de-credito/como-funcionan-las-monedas-en-tarjetas-de-credito/
- S33: https://piggy.com.ar/guias/mejor-app-finanzas-personales-argentina/
- S34: https://piggy.com.ar/ayuda/primeros-pasos/como-navegar-tu-balance-mensual/
- S35: https://piggy.com.ar/ayuda/objetivos/como-crear-un-objetivo-de-gasto/
- S36: https://piggy.com.ar/ayuda/objetivos/
- S37: https://piggy.com.ar/integraciones/claude/
- S38: https://piggy.com.ar/
- S39: https://piggy.com.ar/integraciones/chatgpt/
- S40: https://piggy.com.ar/gastos-compartidos/
- S41: https://piggy.com.ar/piggy-vs-splitwise.html
- S42: https://piggy.com.ar/integraciones/mercado-pago/
- S43: https://piggy.com.ar/ayuda/mercado-pago/que-datos-importa-mercado-pago/
- S44: https://piggy.com.ar/ayuda/tarjetas-de-credito/como-importar-resumen-de-tarjeta/
- S45: https://piggy.com.ar/plantilla-gastos-excel/
- S46: https://play.google.com/store/apps/details?id=com.eraia&hl=en_US
- S47: https://piggy.com.ar/comparativas/money-manager/
- S48: https://piggy.com.ar/ayuda/ripio/que-datos-importa-ripio/
- S49: https://piggy.com.ar/wallet-manager/
- S50: https://piggy.com.ar/ayuda/objetivos/editar-archivar-historial-de-objetivos/
- S51: https://piggy.com.ar/ayuda/gastos-compartidos/como-impactan-en-tu-analisis/
- S52: https://piggy.com.ar/integraciones/gemini/
- S53: https://apps.apple.com/us/app/piggy-control-de-gastos/id6740286427
- S54: https://piggy.com.ar/sitemap.xml
- S55: https://piggy.com.ar/guias/mejor-app-finanzas-personales-uruguay/
- S56: https://piggy.com.ar/blog/cuanto-voy-a-pagar-tarjeta.html
- S57: https://piggy.com.ar/ayuda/
- S58: https://piggy.com.ar/ayuda/gastos-e-ingresos/
- S59: https://piggy.com.ar/ayuda/integraciones/seguridad-y-privacidad-ia/

## Finy

Product as audited: Finy - Finanzas con IA (App Store title; US-locale subtitle "Control de gastos con IA"; Google Play title "Finy: Control de gastos con IA", package com.finy.app…. Official site: https://www.finyapp.io/. Second reader's overall confidence: high.

Could not verify: Google Play listing (https://play.google.com/store/apps/details?id=com.finy.app) could not be fetched (content…; Year of App Store version dates (page renders day/month only; inferred 2026 from copyright and policy dates); Split calculation modes (equal/percentage/shares/exact) and debt simplification; Exchange-rate source and conversion timing (historical vs current, official vs blue); Mercado Pago connection mechanism (OAuth vs credentials) and what the 'bank by email' automation reads exactly; Apple Watch, Lock Screen widgets, Siri Shortcuts/App Intents, Live Activities, privacy mode, accessibility sup…; Whether the lifetime purchase carries the Pro monthly quotas or a different ceiling, and what happens when a q…; Brand palette, typography and icon design (not extractable from fetched text); App Store 'English' language metadata versus site's Spanish+English claim.

| Group | Capability | Status | What the source says | Sources |
| --- | --- | --- | --- | --- |
| Capture | manual entry | ● | Manual expense entry exists and works offline, syncing when back online (offline mode shipped in 1.3.0). | S1, S2 |
| Capture | voice capture | ● | Speak the expense (e.g. a supermarket amount) and the AI extracts amount, category and payment method; needs internet (cloud processing). | S3, S1, S2 |
| Capture | multi-entry voice (several movements in one utterance) | ◐ | Multi-movement detection is documented for photos (one image with several notifications/lines loads all expenses, 1.0.2) and 'batch photo/audio upload' (1.2.0); no explic… | S4, S2 |
| Capture | AI categorization | ● | Automatic categorization of every capture; improved classifier in 2.0; a confirmation step before saving lets the user correct the AI. | S5, S6 |
| Capture | Apple Pay / Wallet Shortcut capture | ? | No mention of Apple Pay, Wallet or Shortcuts in the listing, site or release notes. Closest is sharing a bank screenshot/notification image into Finy (1.0.3). · 2nd reader: Still no Apple Pay, Wallet or Shortcuts mention, but the 1.1.2 note says the new Conexiones section holds Mercado Pago and a "Pago sin contacto" (cont… | S2, S1 |
| Capture | Dynamic Island / Live Activity | ? | Not mentioned anywhere. | — |
| Capture | WhatsApp / messaging capture | ? | Not mentioned; capture happens in the in-app chat/assistant, not via WhatsApp or Telegram. | S3 |
| Capture | widgets (Home/Lock Screen) | ● | Home-screen widget showing the current month's spend with quick actions to add an expense or open the chat (1.1.0), redesigned with voice and photo capture from the widge… | S2, S1 |
| Capture | Quick Actions (home-screen long-press) | ● | Long-press the app icon to record an expense, ask the AI or more (1.0.2). | S4 |
| Capture | external integrations / Shortcuts / App Intents | ◐ | Share-sheet import of bank screenshots into Finy (1.0.3) and a 'connect your bank by email' automation (1.0.4) that reads emailed bank notices; Mercado Pago connection in… | S4 |
| Organization | categories | ● | Categories with per-category analytics and suggested categories at onboarding (1.1.6). | S7 |
| Organization | custom categories | ● | Categories are configurable 'within the app's structure'; the chat can create categories (1.1.5-era notes). | S8, S2 |
| Organization | tags | ? | Not mentioned. | — |
| Organization | subcategories | ? | Not mentioned. | — |
| Organization | search | ◐ | The AI chat can find and modify a movement conversationally (1.2.0/1.2.1); a classic search field is not documented. | S4 |
| Organization | filters | ● | Filters by movement type (1.1.5) and by account/card (1.2.0); custom period selection (1.2.0). | S2, S5 |
| Organization | merchant intelligence (normalisation, logos, rules) | ? | Receipt OCR extracts merchant, total and date; no normalisation, logos or rules documented. | S6 |
| Organization | notes | ? | Not mentioned. | — |
| Organization | attachments / receipts | ◐ | Receipt photos are scanned to create the movement (user content photos/audio collected per privacy label); whether the image stays attached to the movement is not documen… | S7 |
| Spending / Money | accounts | ● | Accounts and cards section redesigned in 1.2.0 with balances and filtering; Mercado Pago balance shown since 2.0. | S5 |
| Spending / Money | credit cards | ◐ | Cards exist as payment methods and as a PDF statement import source; the site itself contrasts this with Mobills' dedicated card module. | S9 |
| Spending / Money | statement cycles (closing/due dates) | ○ | The Finy-vs-Mobills page states Finy handles cards only as payment method plus PDF, versus a dedicated module with closing and due dates in Mobills. | S9 |
| Spending / Money | installments (cuotas) | ● | Automatic installment detection splits a purchase across months as one transaction with an installment number; future-installments detail view (1.1.0); installment editin… | S3, S10, S2 |
| Spending / Money | refunds | ? | Not mentioned. | — |
| Spending / Money | early installment payoff | ? | Not mentioned. | — |
| Spending / Money | recurring expenses | ● | Recurring transactions can be set up (fixes in 1.2.1; US description lists recurring management). | S1, S5 |
| Spending / Money | subscriptions | ◐ | Subscription setup and 'subscription price alerts' (1.2.2) exist; no dedicated subscriptions report documented. | S1, S7 |
| Spending / Money | debts / receivables (personal loans) | ◐ | Only as who-owes-whom balances inside shared spaces; no personal loan ledger documented. | S11 |
| Spending / Money | multiple currencies | ● | 40+ currencies (USD, EUR, ARS, MXN, BRL, COP, CLP, UYU, PEN); App Store notes emphasise USD/ARS side by side (1.2.0) and multi-currency statistics (1.1.3). | S3, S5 |
| Spending / Money | FX semantics | ◐ | Each movement keeps its original currency, no forced conversion (site FAQ and Argentina guide); the Ábaco comparison claims historical exchange-rate tracking with convers… · 2nd reader: The note misreads the Ábaco comparison table: the historical-rate row ("cotización histórica") is Ábaco's cell; Finy's cell says only multi-currency w… | S1, S12, S13 |
| Spending / Money | cash flow view | ◐ | Movements and statistics screens, 6-month trends, income vs expense not explicitly described as a cash-flow view. | S2 |
| Spending / Money | future commitments / upcoming payments | ◐ | Future installments detail view (1.1.0) and reminders for recurring payments; no unified upcoming-payments calendar documented. | S2 |
| Budgeting / Planning | total budget | ◐ | Budgets can be created (also via chat, 1.1.5); the site says budgets by category 'with reports, less deep'; a single total monthly budget is not distinguished. · 2nd reader: The Play description adds a line about seeing how much of the monthly budget remains, which hints at a single monthly figure, but nothing says whether… | S9, S14 |
| Budgeting / Planning | category budgets | ● | Category-level budget tracking against targets. | S1, S9 |
| Budgeting / Planning | goals | ● | Savings goals with tracking, creatable through the AI chat (1.1.4/1.1.5); the advisor checks last month's goal completion. | S2, S3 |
| Budgeting / Planning | flexible vs fixed budgets / rollover | ? | Not mentioned. | — |
| Budgeting / Planning | pay-cycle periods (custom month start / salary cycles) | ◐ | Custom period selection for views (1.2.0); no custom month start or salary cycle documented. | S5 |
| Budgeting / Planning | calendar view | ? | Not mentioned. | — |
| Budgeting / Planning | projections / forecasts | ◐ | The chat answers affordability questions and travel-savings calculations; no projection view. Proactive mid-month advisor alerts are only 'under consideration'. | S3, S15 |
| Budgeting / Planning | reminders | ● | Reminders for recurring payments; smart notifications deep-link to the movement (1.1.0); weekly summary every Sunday. | S7, S4 |
| Reporting | by category | ● | Category breakdowns with percentage comparisons. | S3 |
| Reporting | daily | ? | Not mentioned. | — |
| Reporting | trends over time | ● | 6-month spending trend (1.0.4) and redesigned statistics (2.0). | S2 |
| Reporting | period comparisons | ● | Month-over-month comparisons are an example of an AI query; advisor compares with the previous month. | S1 |
| Reporting | by merchant | ? | Not mentioned. | — |
| Reporting | subscriptions report | ? | Not mentioned beyond price alerts. | — |
| Reporting | calendar report | ? | Not mentioned. | — |
| Reporting | custom date ranges | ● | Custom period selection in statistics (1.2.0). | S5 |
| Reporting | AI-generated reports | ● | Monthly advisor on the 1st: story-format analysis of last month plus one concrete action; first analysis free; 'advanced reports' are Pro-only. | S3, S7 |
| Reporting | explain / query financial data in natural language | ● | Chat answers questions over the user's own ledger (how much on delivery, unusual spend); metered as AI queries (10/75/200 per month). | S1 |
| Collaboration | split expenses | ● | Finy Split (1.0.3) via shared spaces; a split-without-creating-a-space mode is 'in development'. | S4, S15 |
| Collaboration | equal split | ? | Split modes are never named; only 'calculates who owes whom'. · 2nd reader: The couples guide discusses half-and-half, income-proportional and common-pool arrangements as general advice for couples, and then says shared spaces… | S11, S16 |
| Collaboration | percentage split | ? | Not mentioned. | S11 |
| Collaboration | share-based split | ? | Not mentioned. | S11 |
| Collaboration | exact-amount split | ? | Not mentioned. | S11 |
| Collaboration | groups | ● | Shared spaces (Casa, Viaje, Negocio) with per-plan caps: Free 1 (personal only), Plus 3, Pro 10. | S3, S11 |
| Collaboration | invitations / participants without accounts | ◐ | Invite by link; each participant logs from their own phone with their own account; invitees need no paid plan (creator's tier governs). | S1, S16 |
| Collaboration | household / partner shared finances | ● | Positioned for couples, roommates and small recurring groups; space expenses are visible to members, personal expenses stay private. | S1, S11 |
| Collaboration | debt simplification | ? | Only balance calculation is described; no simplification algorithm mentioned. | S11 |
| Automation | Apple Pay capture automation | ? | Not mentioned. | — |
| Automation | Mercado Pago sync | ● | Authorize from the in-app Conexiones section; payments import automatically, balance shown, cuotas imported monthly; disconnect any time. | S3, S1 |
| Automation | bank sync (aggregator/open banking) | ○ | No direct bank connections; the Taller page records a decision against it (needs per-bank agreements and regulatory authorization), while the FAQ says direct integrations… | S15, S1, S17 |
| Automation | imports (generic) | ● | PDF credit-card/bank statement import with AI extraction and review (1.1.4/1.1.5, metered as scans); screenshot sharing (1.0.3); bank email automation (1.0.4). | S4, S3 |
| Automation | CSV import/export | ◐ | Export to CSV (Excel/Sheets compatible) exists; CSV import is not offered. | S1 |
| Automation | Excel import/export | ◐ | Excel export shipped in 1.0.3; the site explicitly says there is no Excel importer. | S4, S8 |
| Automation | JSON import/export | ? | Not mentioned (FAQ lists CSV only). | S1 |
| Automation | notification-based automation (reading bank/payment notifications) | ◐ | Reading bank emails (1.0.4) and screenshots of notifications (1.0.2/1.0.3) via the AI; no on-device notification listener documented. | S4 |
| Automation | recurring detection | ◐ | Installments are auto-detected; automatic detection of recurring expenses is not claimed (the AI guide implies manual setup). | S6 |
| Privacy / Platform | local-first / on-device data | ○ | Cloud-first: data lives in Supabase; offline manual entry is a queue that syncs later; AI runs on OpenAI, Anthropic and Google Gemini. | S18, S1 |
| Privacy / Platform | account required or not | ● (● = account required) | Registration required (email, Google or Apple sign-in). | S19, S18 |
| Privacy / Platform | cloud sync | ● | Server-side account data; restore purchases across devices. · 2nd reader: "Restaurar compra" restores purchases, not data; the data claim rests on Supabase cloud storage (privacy policy) and the 1.3.0 note that offline entri… | S18, S5, S2 |
| Privacy / Platform | iCloud / CloudKit | ○ | Storage is Supabase, not iCloud. | S18 |
| Privacy / Platform | Face ID / app lock | ● | Biometric lock (Face ID/fingerprint) per FAQ. | S1 |
| Privacy / Platform | hidden amounts (privacy mode) | ? | Not mentioned. | — |
| Privacy / Platform | Apple Watch | ? | Not mentioned on the listing or site. | S7 |
| Privacy / Platform | widgets | ● | Home-screen widget (see Capture). | S1 |
| Privacy / Platform | accessibility (VoiceOver, Dynamic Type) evidence | ? | No accessibility claims found. · 2nd reader: The App Store page states the developer has not yet indicated which accessibility features the app supports (AR/es Accesibilidad section). | S2 |
| Privacy / Platform | localization (languages, regions) | ◐ | Site FAQ: Spanish and English with regional slang in voice; App Store metadata lists English only; site content Spanish; country guides for AR, CO, MX; Mercado Pago in 7… | S1, S7 |
| Privacy / Platform | Android availability | ● | Google Play, Android 12+ (com.finy.app); Play listing itself could not be fetched. · 2nd reader: Now verified on the Play listing itself: version 2.0.2, updated 15 Sep 2026, released on Play 11 Apr 2026, 100+ downloads, contains ads, in-app produc… | S3, S14 |
| Privacy / Platform | web availability | ○ | No web app; experience adapted to large screens but not desktop-first per FAQ. | S1 |
| Monetization | free tier and its limits | ● | Gratis: 100 movements/month, 10 AI queries, 2 photo/PDF scans, 1 space (personal), ads (AdMob). Plus: 500/75/30/3 spaces, no ads. | S3, S1 |
| Monetization | trial | ● | 14 days of Pro on install, no card, reverts to Free automatically. | S1 |
| Monetization | monthly price | ● | App Store IAP (USD on both AR and US storefronts): Finy Plus USD 2.99/month, Finy Pro USD 4.99/month. | S2, S5 |
| Monetization | annual price | ● | Finy Plus USD 24.99/year (site shows 2.08/month), Finy Pro USD 39.99/year (site shows 3.33/month). Web sales via Gumroad are also mentioned in the terms (non-refundable). | S3, S2, S19 |
| Monetization | lifetime price | ● | 'Finy Pro para siempre' USD 99.99 one-time, added in 2.0.2 (non-renewing); lifetime buyers get a private feedback channel on the Taller page. · 2nd reader: Confirmed on both storefronts (AR: Finy Pro para siempre USD 99.99; US: Finy Pro Lifetime $99.99), in the 2.0.2 notes (one-time tab "Una vez", restore… | S2, S15, S5, S14 |
| Monetization | what Pro gates (the meaningful boundary) | ● | Pro raises the metered quotas (1,000 tx, 200 AI queries, 100 scans, 10 spaces), removes ads and unlocks advanced reports; the monthly advisor's first analysis is free for… | S3, S1 |
| Future Finance | savings goals | ● | Goals with tracking, created manually or via chat. | S7 |
| Future Finance | investments | ○ | Site repeatedly states it is not for investment tracking. · 2nd reader: Confirmed absent as a module (FAQ, Argentina guide, comparativas index). Note the 1.1.4 movement-type filter includes Ahorro and Inversión as movement… | S12, S20, S1, S2 |
| Future Finance | net worth | ? | Not mentioned. | — |
| Future Finance | loans / mortgages | ○ | The Excel comparison concedes amortizations and investment models are spreadsheet territory, not Finy's. | S8 |
| Future Finance | assets (property, vehicles) | ? | Not mentioned. | — |
| Capture | repeat / duplicate a past movement (added) | ● | A Repeat button in the movement detail re-registers an earlier expense with the same data and today's date (1.0.1 notes). | S2 |
| Spending / Money | transfers between accounts (added) | ● | Transfers can be recorded through the AI chat with a sentence like moving an amount from account A to B (1.1.6 notes); Mercado Pago sync distinguishes transfers and shows… | S2 |
| Budgeting / Planning | income and savings tracking (financial profile) (added) | ● | Setup step asks for monthly income and a savings currency; the AI loads this profile when the chat starts; movement types include Ingresos and Ahorro; weekly and monthly… | S2, S14 |
| Reporting | weekly summary (added) | ● | Weekly spending summary delivered on Sundays (1.2.1 notes); weekly and monthly AI reports existed before the 2.0 advisor (1.2.0 notes). | S2 |
| Automation | duplicate detection on imports (added) | ● | PDF statement import detects duplicates and avoids re-importing (1.1.3 and 1.1.4 notes); Mercado Pago sync avoids duplicating earlier movements (1.1.4 notes). | S2 |
| Organization | swipe to edit/delete, movement detail panel (added) | ● | Swipe gestures on movements to edit or delete (1.3.0); tap a movement for a detail panel with edit, delete and repeat (1.0.1). | S2 |
| Privacy / Platform | dark mode (added) | ● | Dark-mode visual fixes are listed in 1.1.5, so a dark appearance exists; the Taller describes a unified palette of the same greens and greys across screens (2.0.x). | S2, S15 |
| Monetization | promo codes (added) | ● | Promotional codes can be redeemed from the Más section (1.1.4 notes); a Pro-trial countdown is shown on the home screen. | S2 |
| Capture | contactless payment connection ("Pago sin contacto") (added) | ? | The 1.1.2 note lists a "Pago sin contacto" entry next to Mercado Pago in the Conexiones section; no page explains what it connects to or how it captures anything. | S2 |
| Capture | guided onboarding with suggested categories (added) | ● | Redesigned onboarding with suggested starter categories, a guided tour of the three capture methods and a first-steps checklist on Home (1.1.5 notes). | S2 |
| — | product naming / latestVersion dating (correction) | ● | 2nd reader: Year is verifiable: the App Store HTML carries datetime attributes (1.0 = 2026-03-24 ... 2.0.2 = 2026-09-18) on both storefronts, so no inference is n… | S2, S5, S14 |
| — | release-note version attribution (notableRecentChanges and every note citing a 1.0.x-1.2.x… | ● | 2nd reader: The audit's version numbers are one step too high from 1.0.1 to 1.2.1 and 1.2.2 merges two releases. Pairing each history <li>'s notes with its own ve… | S2, S5 |

Sources:

- S1: https://www.finyapp.io/preguntas-frecuentes
- S2: https://apps.apple.com/ar/app/finy-control-de-gastos-con-ia/id6760370721?l=es
- S3: https://www.finyapp.io/
- S4: https://apps.apple.com/us/app/finy-control-de-gastos-con-ia/id6760370721?l=es
- S5: https://apps.apple.com/us/app/finy-control-de-gastos-con-ia/id6760370721
- S6: https://www.finyapp.io/guias/apps-de-gastos-con-inteligencia-artificial
- S7: https://apps.apple.com/ar/app/finy-control-de-gastos-con-ia/id6760370721
- S8: https://www.finyapp.io/comparativas/finy-vs-excel
- S9: https://www.finyapp.io/comparativas/finy-vs-mobills
- S10: https://www.finyapp.io/guias/mejor-app-de-gastos-mexico
- S11: https://www.finyapp.io/comparativas/finy-vs-splitwise
- S12: https://www.finyapp.io/guias/mejor-app-de-gastos-argentina
- S13: https://www.finyapp.io/comparativas/finy-vs-abaco
- S14: https://play.google.com/store/apps/details?id=com.finy.app&hl=es_AR&gl=AR
- S15: https://www.finyapp.io/taller
- S16: https://www.finyapp.io/guias/apps-para-dividir-gastos-con-tu-pareja
- S17: https://www.finyapp.io/guias/mejor-app-de-gastos-colombia
- S18: https://www.finyapp.io/politica-privacidad
- S19: https://www.finyapp.io/condiciones-servicios
- S20: https://www.finyapp.io/comparativas
- S21: https://www.finyapp.io/guias

## Splitwise

Product as audited: Splitwise. Official site: https://www.splitwise.com/. Second reader's overall confidence: high.

Could not verify: Which App Store 'Splitwise Pro' SKU maps to which plan (all ten IAPs share one name; mapping monthly/Individua…; Free trial length and eligibility (only referenced in the cancellation article); Widgets, Quick Actions, Siri/Shortcuts, Live Activities (no primary source mentions them either way); Whether Face ID/Touch ID backs the passcode lock; Whether the original amount is retained after Pro currency conversion; Custom categories / subcategories; Period-comparison reports; Exact 'select countries' for transaction import beyond the US (Pro page says US only); splitwise.com/faq returned 404; Google Play page could only be read via raw HTML (version 26.8.3 from embedded….

| Group | Capability | Status | What the source says | Sources |
| --- | --- | --- | --- | --- |
| Capture | manual entry | ● | Add expenses, IOUs or informal debts in any currency, with offline entry; expenses backed up online. Multiple payers per expense. | S1 |
| Capture | voice capture | ? | No mention in App Store description, Pro page or help centre. | S1, S2 |
| Capture | multi-entry voice (several movements in one utterance) | ? | No voice feature documented anywhere read. | — |
| Capture | AI categorization | ○ | Categorisation is manual ('expense categorization' listed as a feature); the only automatic recognition is OCR receipt scanning (Pro) which detects items, not an AI categ… | S1, S2 |
| Capture | Apple Pay / Wallet Shortcut capture | ○ | Not supported; the only automatic purchase capture is the US-only Splitwise Card (Mastercard debit) which adds purchases to Splitwise and can auto-split them. · 2nd reader: Still no Shortcut/Wallet capture of arbitrary cards. Nuance to add: the official card page says the Splitwise Mastercard Debit Card (Coastal Community… | S3, S1 |
| Capture | Dynamic Island / Live Activity | ? | Not mentioned in listing, blog or help centre. | S1, S4 |
| Capture | WhatsApp / messaging capture | ○ | No messaging integration; capture is in-app, web or card-based only. | S1, S5 |
| Capture | widgets (Home/Lock Screen) | ? | No widget mentioned in App Store description, blog feature posts or help centre; could not confirm presence or absence. | S6, S4 |
| Capture | Quick Actions (home-screen long-press) | ? | Not documented. | — |
| Capture | external integrations / Shortcuts / App Intents | ◐ | No Siri/Shortcuts documented. Integrations are payment rails (Splitwise Pay, Venmo, PayPal in US; Pay by Bank in select EU countries; Paytm India per listing) and Google… · 2nd reader: No Siri/Shortcuts anywhere (listing, Pro page, KB index of 76 legacy articles, blog). Payment integrations confirmed: App Store description lists Venm… | S7, S1 |
| Organization | categories | ● | Expense categorisation is a listed core feature; 'spending by category' charts are Pro. | S1 |
| Organization | custom categories | ? | Help centre and listing do not say whether categories are editable. | S8 |
| Organization | tags | ○ | Not in the feature list; organisation is by group/friendship and category only. | S1 |
| Organization | subcategories | ? | Not documented. | — |
| Organization | search | ◐ | Searching the full expense history is a Pro-only feature. | S2, S9 |
| Organization | filters | ◐ | Views are per group/friendship, with 'show settled expenses' toggles and monthly/all-time Totals; no general filter UI documented. | S10 |
| Organization | merchant intelligence (normalisation, logos, rules) | ○ | No merchant model; expenses have a free description. The Pro 'default splits' is the only rule-like feature. | S2 |
| Organization | notes | ● | Comments directly on expenses, plus an activity feed and per-expense edit history. | S1 |
| Organization | attachments / receipts | ◐ | Receipt images can be attached; Pro adds 10GB high-resolution cloud receipt storage, OCR scanning and itemisation (assign scanned items, tax, tip and discounts to people)… | S1, S11 |
| Spending / Money | accounts | ○ | No bank/cash account model; the ledger is balances between people. Help centre says Splitwise is not meant as a personal finance manager. | S12 |
| Spending / Money | credit cards | ○ | No card accounts; only US Pro 'transaction import' from connected cards (via Plaid per privacy policy) and the Splitwise Card debit product. | S2, S13 |
| Spending / Money | statement cycles (closing/due dates) | ○ | No card or statement concept. | S1 |
| Spending / Money | installments (cuotas) | ○ | No instalment plans; recurring expenses repeat indefinitely rather than for N instalments. | S14 |
| Spending / Money | refunds | ◐ | A 'reimbursement' split type records a refund one person received and redistributes it; web only, not available in the mobile apps. | S15 |
| Spending / Money | early installment payoff | ○ | No instalment model. | S14 |
| Spending / Money | recurring expenses | ● | Weekly, fortnightly, monthly or yearly repeats set from the date field; repeat indefinitely until edited to 'just this once' (mobile) or cancelled (web); optional email b… | S14 |
| Spending / Money | subscriptions | ○ | No subscription tracking beyond generic recurring bills. | S1 |
| Spending / Money | debts / receivables (personal loans) | ● | Core model: informal debts and IOUs between friends, cross-group total balance per person, settle-up records; loans/IOUs explicitly listed as a use case. | S1 |
| Spending / Money | multiple currencies | ● | 100+ currencies; each expense has its own currency (defaults to the last used in that group); balances kept separately per currency; account-level default currency. | S16, S17 |
| Spending / Money | FX semantics | ◐ | Original currency is kept and never auto-converted; changing an expense's currency does not change the number. Pro 'Convert to [default currency]' rewrites all expenses i… | S18, S16 |
| Spending / Money | cash flow view | ◐ | Totals screen per group: total group spend, what you paid, your share, paid to/received from others, net balance change, by month or all-time; computed on-device. | S10 |
| Spending / Money | future commitments / upcoming payments | ◐ | Recurring expenses show next occurrence date; web has a recurring list; no upcoming-payments calendar. · 2nd reader: Confirmed only: web has an all-recurring-expenses list ('All Expenses' then calendar icon) and mobile explicitly cannot browse recurring expenses in o… | S14 |
| Budgeting / Planning | total budget | ○ | No budgets; 'budgeting tools' in the listing means Pro spending-by-category charts. | S1, S12 |
| Budgeting / Planning | category budgets | ○ | Not offered; only category charts (Pro). | S2 |
| Budgeting / Planning | goals | ○ | Not in feature set. | S5 |
| Budgeting / Planning | flexible vs fixed budgets / rollover | ○ | No budgets. | S2 |
| Budgeting / Planning | pay-cycle periods | ○ | Totals are calendar months or all-time. | S10 |
| Budgeting / Planning | calendar view | ○ | Not documented; web has a recurring-expense list behind a calendar icon only. | S14 |
| Budgeting / Planning | projections / forecasts | ○ | Not offered. | S2 |
| Budgeting / Planning | reminders | ◐ | Email/push notifications for changes by others (60-second delay), optional email before a recurring posting, invite reminder sent once; no balance-due reminders documente… | S19, S20 |
| Reporting | by category | ◐ | Spending-by-category charts and graphs are Pro-only. | S2, S1 |
| Reporting | daily | ○ | Totals are monthly or all-time. | S10 |
| Reporting | trends over time | ◐ | Pro charts; Totals by month free. | S2 |
| Reporting | period comparisons | ? | Not documented. | — |
| Reporting | by merchant | ○ | No merchant concept. | S1 |
| Reporting | subscriptions report | ○ | Not offered. | S2 |
| Reporting | calendar report | ○ | Not offered. | S2 |
| Reporting | custom date ranges | ○ | Totals screen is month or all-time only. | S10 |
| Reporting | AI-generated reports | ○ | No AI features anywhere in listing, Pro page or blog. | S2, S4 |
| Reporting | explain / query financial data in natural language | ○ | No assistant; the blog's 'Ask Splitwise' is an advice column, not a product feature. | S4 |
| Collaboration | split expenses | ● | The core product: expenses split among group members or a friendship; multiple payers per expense. | S1 |
| Collaboration | equal split | ● | Default split mode. | S11 |
| Collaboration | percentage split | ● | Available on mobile and web. | S11 |
| Collaboration | share-based split | ● | Weighted shares (used for couples, e.g. 2 shares vs 0); cannot be combined with itemisation. | S21 |
| Collaboration | exact-amount split | ● | Also 'adjustment' (one person +/- then rest equal), 'reimbursement' (web only) and 'itemized' (items with tax/tip/discount; mobile receipt scanning needs Pro). | S11, S2 |
| Collaboration | groups | ● | Groups (trips, homes, events) with cover photos, per-group simplify-debts setting, flat permissions (anyone in the group can edit or delete any expense, no admin role), a… | S20, S22 |
| Collaboration | invitations / participants without accounts | ● | Invite by email or phone (one invite + one reminder); expenses can be added for them before they accept and indefinitely if they never do; a name-only placeholder friend… | S23 |
| Collaboration | household / partner shared finances | ◐ | Couples are a listed use case handled as a group/friendship with shares; Pro has a 'Duo' annual plan for two people. No joint accounts or shared budget. | S21, S9 |
| Collaboration | debt simplification | ● | Per-group toggle (any member can switch it) that restructures who pays whom to minimise payments while preserving net balances; re-runs on every new expense/payment; work… | S24 |
| Automation | Apple Pay capture automation | ○ | Not supported; only the US Splitwise Card auto-splits purchases. | S3 |
| Automation | Mercado Pago sync | ○ | No Argentine or LatAm payment integration; payment rails are US (Splitwise Pay, Venmo, PayPal) and select EU bank-to-bank; elsewhere users record payments manually. | S7 |
| Automation | bank sync (aggregator/open banking) | ◐ | Pro 'transaction import' connects credit/debit cards to pull transactions for splitting, US only (Pro page) / 'select countries'; privacy policy names Plaid as the aggreg… | S2, S13, S25 |
| Automation | imports (generic) | ○ | No file import documented; only card transaction import (Pro, US). | S26 |
| Automation | CSV import/export | ◐ | Export only: per group or friendship spreadsheet (CSV) from mobile and web, one row per expense with each person's balance impact; no CSV import. | S26, S27 |
| Automation | Excel import/export | ◐ | Spreadsheet export is CSV, openable in Excel; no Excel import. | S26 |
| Automation | JSON import/export | ◐ | Pro-only JSON backup of the whole account, downloadable from the web app's Advanced Features; no import. | S26 |
| Automation | notification-based automation | ○ | No reading of bank/payment notifications. | S1 |
| Automation | recurring detection | ○ | Recurring bills are created manually from the date field; no detection. | S14 |
| Privacy / Platform | local-first / on-device data | ○ | Cloud-backed account; offline entry syncs later and Totals compute locally, but data lives on Splitwise servers (US and other countries). | S13, S28 |
| Privacy / Platform | account required or not | ● (● = account required) | Account required (email/phone/Google/Facebook login); invitees can be tracked without accepting. | S29, S13 |
| Privacy / Platform | cloud sync | ● | Own backend; everyone in a group sees the same ledger across iOS, Android and web. | S1 |
| Privacy / Platform | iCloud / CloudKit | ○ | Sync is Splitwise's own cloud, not iCloud. | S13 |
| Privacy / Platform | Face ID / app lock | ◐ | iPhone app has a passcode lock that triggers after the app has been closed 2+ minutes; biometrics not mentioned in the help article. · 2nd reader: Passcode lock confirmed (activates after the app has been closed 2+ minutes); a second legacy article adds that 10 wrong entries log the user out and… | S30, S31 |
| Privacy / Platform | hidden amounts (privacy mode) | ○ | Not offered; privacy is by visibility rules (only people in an expense or its group see it; non-group expenses visible only to those involved). | S32 |
| Privacy / Platform | Apple Watch | ○ | App Store compatibility lists iPhone, iPad and Apple Vision only; no Watch app. | S1, S6 |
| Privacy / Platform | widgets | ? | Not documented in any source read. | S6 |
| Privacy / Platform | accessibility (VoiceOver, Dynamic Type) evidence | ? | App Store says the developer has not yet indicated supported accessibility features. | S1 |
| Privacy / Platform | localization (languages, regions) | ● | 12 App Store languages including Spanish; 100+ currencies; default currency per account. · 2nd reader: 12 languages confirmed in both storefronts' metadata (Spanish included) and '100+ currencies' in the description; note the description body itself sti… | S6, S1 |
| Privacy / Platform | Android availability | ● | Google Play, updated Sep 16, 2026, 10M+ downloads, 4.0 stars / 195K reviews, Editors' Choice, in-app purchases. · 2nd reader: Play listing raw HTML confirms updated Sep 16, 2026, 10M+ downloads, 4.0 stars, ~195K reviews, embedded version strings up to 26.8.3, in-app products… | S33 |
| Privacy / Platform | web availability | ● | Full web app; some features (reimbursement split, recurring list, JSON backup, placeholder friends) are web-only. | S5, S26 |
| Monetization | free tier and its limits | ● | Free: groups, splits, simplify debts, recurring, categories, CSV export, comments, offline entry; capped at 4 expenses per day (resets next day; a friend can add instead)… | S9, S34, S2 |
| Monetization | trial | ◐ | The cancellation article refers to cancelling a free trial, but no duration or eligibility is published. · 2nd reader: Only official mention remains the cancellation article's sentence about cancelling 'a Splitwise Pro subscription or free trial'; no duration or eligib… | S35, S1 |
| Monetization | monthly price | ◐ (was ●) | App Store IAP 'Splitwise Pro' tiers (all named identically). US storefront: USD 2.99, 3.99, 4.99 (monthly, several SKUs). AR storefront (prices in USD): 2.99, 3.99, 4.99,… · 2nd reader: Prices re-read on both storefronts and confirmed (US: $2.99 x3, $3.99 x1, $4.99 x4 rows; AR: USD 2.99 x2, 3.99 x1, 4.99 x3, 7.99 x1), all ten rows nam… | S1, S6, S9, S2 |
| Monetization | annual price | ◐ (was ●) | US: USD 29.99 and 39.99 (Individual and Duo annual). AR: USD 39.99 and 59.99. Annual plans include one Trip Pass granting Pro to a trip group's members for 30 days. · 2nd reader: Amounts confirmed on the listings (US $29.99 and $39.99; AR USD 39.99 and 59.99 x2 rows) but the Individual-vs-Duo mapping is inferred from the KB pla… | S1, S6, S9 |
| Monetization | lifetime price | ○ | No lifetime SKU; all IAPs are renewing subscriptions. | S1 |
| Monetization | what Pro gates | ● | Pro removes the 4/day cap and ads and adds: receipt scanning (OCR) and itemisation, 10GB receipt storage, currency conversion (Open Exchange Rates), charts/spending by ca… | S2, S1, S9 |
| Future Finance | savings goals | ○ | Not offered. | S5 |
| Future Finance | investments | ○ | Not offered. | S5 |
| Future Finance | net worth | ○ | Not offered; only interpersonal balances. | S12 |
| Future Finance | loans / mortgages | ◐ | Informal loans/IOUs between people only; no amortised loans. | S1 |
| Future Finance | assets (property, vehicles) | ○ | Not offered. | S5 |
| Privacy / Platform | appearance / dark mode toggle (added) | ● | Official blog, May 18, 2026: iOS and Android gained an in-app Appearance setting in the account tab with light, dark or match-system; defaults to following the device. | S36 |
| Automation | Splitwise Card in Apple Pay / Google Pay (US) (added) | ● | US-only Mastercard debit card issued by Coastal Community Bank for Splitwise Pay account holders; purchases are added to Splitwise automatically, either 'split as you go'… | S3, S37 |
| Reporting | printable summary (web) (added) | ● | On the web app each group has a 'View Printable Summary' below Settle Up listing all transactions; mobile and web both offer the spreadsheet export with one row per trans… | S27 |
| Collaboration | undo a settle-up / restore deleted expense or group (added) | ● | Help centre carries dedicated articles for undoing an accidental settle-up and restoring deleted expenses and groups (titles read in the category index; bodies not opened… | S38, S22 |
| Monetization | direct web purchase via Stripe (added) | ● | Pro can be bought directly from Splitwise on mobile or web (receipt from Stripe) as well as through the App Store and Google Play; refunds for direct purchases are reques… | S35 |
| Capture | push notifications and activity feed (added) | ● | App Store description lists 'Activity feed and push notifications' for changes; KB says notifications are only for other people's changes, delayed 60 seconds, configurabl… | S1, S19 |

Sources:

- S1: https://apps.apple.com/us/app/splitwise/id458023433
- S2: https://www.splitwise.com/pro
- S3: https://www.splitwise.com/card
- S4: https://blog.splitwise.com/
- S5: https://www.splitwise.com/
- S6: https://apps.apple.com/ar/app/splitwise/id458023433
- S7: https://kb.splitwise.com/payment-integrations/how-do-i-send-money-to-someone-on-splitwise
- S8: https://kb.splitwise.com/
- S9: https://kb.splitwise.com/pro/what-is-splitwise-pro
- S10: https://kb.splitwise.com/balances-and-expenses/can-you-explain-the-totals-screen
- S11: https://kb.splitwise.com/balances-and-expenses/what-are-different-ways-i-can-split-an-expense
- S12: https://kb.splitwise.com/getting-started/can-i-use-splitwise-to-track-my-personal-expenses
- S13: https://www.splitwise.com/privacy
- S14: https://kb.splitwise.com/balances-and-expenses/how-can-i-manage-recurring-expenses
- S15: https://kb.splitwise.com/balances-and-expenses/how-do-i-add-a-refund-or-reimbursement
- S16: https://kb.splitwise.com/balances-and-expenses/how-can-i-manage-a-friendship-or-group-with-multiple-currencies
- S17: https://kb.splitwise.com/account-issues/how-can-i-set-my-default-currency
- S18: https://kb.splitwise.com/pro/how-are-exchange-rates-calculated-for-currency-conversion
- S19: https://kb.splitwise.com/account-issues/why-am-i-not-receiving-email-notifications
- S20: https://kb.splitwise.com/groups/can-i-prevent-group-members-from-changing-expenses-or-set-permissions
- S21: https://kb.splitwise.com/groups/how-do-i-split-an-expense-for-a-couple-that-is-sharing-costs
- S22: https://feedback.splitwise.com/knowledgebase/articles/all
- S23: https://kb.splitwise.com/getting-started/can-i-add-a-friend-without-adding-their-email-address-or-phone-number
- S24: https://kb.splitwise.com/balances-and-expenses/what-is-simplify-debts
- S25: https://feedback.splitwise.com/knowledgebase/articles/174427
- S26: https://kb.splitwise.com/account-issues/how-do-i-export-my-splitwise-data
- S27: https://kb.splitwise.com/balances-and-expenses/how-can-i-double-check-my-balances
- S28: https://kb.splitwise.com/account-issues/how-can-i-deactivate-or-delete-my-account
- S29: https://kb.splitwise.com/getting-started/how-do-i-use-splitwise
- S30: https://feedback.splitwise.com/knowledgebase/articles/425469
- S31: https://feedback.splitwise.com/knowledgebase/articles/921417
- S32: https://feedback.splitwise.com/knowledgebase/articles/436667
- S33: https://play.google.com/store/apps/details?id=com.Splitwise.SplitwiseMobile&hl=en&gl=US
- S34: https://feedback.splitwise.com/knowledgebase/articles/2010350
- S35: https://kb.splitwise.com/pro/how-can-i-cancel-my-splitwise-pro-subscription-and-get-a-refund
- S36: https://blog.splitwise.com/2026/05/18/dark-mode-announcement/
- S37: https://www.splitwise.com/pay
- S38: https://kb.splitwise.com/balances-and-expenses
- S39: https://www.splitwise.com/press
- S40: https://assets.splitwise.com/assets/motel-387139a1fd1be16e7f862f4fbf6d3e1477be040b1cc7d3bc800dabad590ad05c.css
- S41: https://feedback.splitwise.com/knowledgebase
- S42: https://feedback.splitwise.com/knowledgebase/topics/50750-mobile
- S43: https://feedback.splitwise.com/knowledgebase/topics/50754-general
- S44: https://feedback.splitwise.com/knowledgebase/topics/50753-payments
- S45: https://kb.splitwise.com/getting-started
- S46: https://kb.splitwise.com/account-issues
- S47: https://kb.splitwise.com/groups
- S48: https://kb.splitwise.com/payment-integrations
- S49: https://kb.splitwise.com/pro
- S50: https://kb.splitwise.com/splitwise-pay
- S51: https://kb.splitwise.com/groups/how-do-i-create-a-group
- S52: https://kb.splitwise.com/splitwise-pay/how-do-i-set-up-splitwise-pay
- S53: https://kb.splitwise.com/splitwise-pay/how-do-i-connect-a-funding-source
- S54: https://blog.splitwise.com/2019/07/

## MoneyCoach

Product as audited: MoneyCoach (App Store titles: AR "Finanzas Personales MoneyCoach", US "MoneyCoach AI Budget Planner"). Official site: https://moneycoach.ai. Second reader's overall confidence: medium.

Could not verify: Exact calendar date of 12.1: both storefronts show only '6 days ago' (read 2026-10-03); the changelog page had…; Official pricing page: https://moneycoach.ai/pricing, /features/multicurrency-accounts, /goals, /credit-card-m…; Free tier budget limit number (site says 'free budget limit' without a figure).; Trial length (only 'free trial' / 'first month on us').; FX rate provider and whether reports use historical rates.; Multi-transaction voice entry in one utterance.; Lock Screen widgets and home-screen Quick Actions specifically.; VoiceOver support (not declared in the App Store accessibility section).; Asset accounts (property, vehicles).; Maximum Family Sync participants and conflict handling.; Web search budget was exhausted in this session, so secondary sources were not consulted; DuckDuckGo/Bing fetc….

| Group | Capability | Status | What the source says | Sources |
| --- | --- | --- | --- | --- |
| Capture | manual entry | ● | Full transaction form (amount, category/subcategory, account, payee, description, tags, location, repeat rule, attachments) plus a lighter Quick Entry that needs only an… | S1, S2, S3 |
| Capture | voice capture | ● | Siri via App Intents/Shortcuts: phrases like adding an amount to a category; Siri may ask follow-up questions for account/category then confirms. · 2nd reader: Confirmed with nuance: the Siri guide shows single-amount-to-category phrases, three follow-up questions (amount, account, category) and asks the user… | S4, S5, S6 |
| Capture | multi-entry voice (several movements in one utterance) | ? | Siri guide shows only single-transaction phrases; no documentation found of several transactions in one utterance. | S4 |
| Capture | AI categorization | ● | Machine-learning auto-categorisation that learns from corrections; for bank-synced transactions limited fields are sent to Google Gemini via Firebase Genkit (cloud). · 2nd reader: Confirmed; the Intelligence page describes learning categorisation under Premium and Google Cloud processing, the privacy policy names Gemini via Fire… | S7, S8, S9, S10 |
| Capture | Apple Pay / Wallet Shortcut capture | ● | iOS Shortcuts 'Transaction' automation (Wallet trigger) set to Run Immediately; passes Card/Pass -> account name, Merchant -> payee, Amount, Name -> category. | S11, S12 |
| Capture | Dynamic Island / Live Activity | ● | Since v8.1 (2022-10-21, iOS 16.1+): after adding a transaction and backgrounding the app the amount shows in the Dynamic Island/Lock Screen; long-press expands to categor… · 2nd reader: Confirmed; in addition to the 8.1 blog post and the deactivate guide, the current features page lists Live Activities (budget overview on the Lock Scr… | S13, S14, S1 |
| Capture | WhatsApp / messaging capture | ○ | Feature catalogue lists manual, Watch, widgets, Shortcuts, Apple Pay, CSV and bank sync as the only input paths; no messaging channel exists. | S1, S15 |
| Capture | widgets (Home/Lock Screen) | ● | Interactive Home Screen widgets (iOS 17+) that add preset income/expense without opening the app, budget and goal widgets, Upcoming Bills widget, widget tint support on i… · 2nd reader: Note correction: the audit said Lock Screen widgets were not explicitly documented, but the features page lists 'Lock Screen widgets' (glance at remai… | S16, S1, S17 |
| Capture | Quick Actions (home-screen long-press) | ● (was ?) | Not documented on any page read; Control Center controls (add expense/income/transfer) are documented instead. · 2nd reader: Official changelog entry 11.0.2 (Sep 26, 2025) lists 'fixed Home Screen quick actions', which only makes sense if the app ships Home Screen quick acti… | S17, S5 |
| Capture | external integrations / Shortcuts / App Intents | ● | App Intents for Shortcuts and Siri (add transaction, ask net worth), v12 added transaction search with filters via Shortcuts; Control Center controls; macOS menu-bar Shor… | S1, S5, S18, S19 |
| Organization | categories | ● | Default category set (five more added in 12.1: Subscriptions, Reimbursement/Refunds, Online Shopping, Settlement, Income Transfer); grid picker, icon library, colour per… | S20, S5 |
| Organization | custom categories | ● | Create, edit, merge categories and subcategories; custom icon colours. | S21, S5 |
| Organization | tags | ● | Multiple tags per transaction, stored as hashtags inside the description; a Tags report groups by them. | S3, S22 |
| Organization | subcategories | ● | Subcategories are first-class, budgetable and reportable. | S23, S24 |
| Organization | search | ● | 'Ultra-fast' transaction search (11.5) with live results, umlaut/special-character support; search exposed to Shortcuts in v12. | S5 |
| Organization | filters | ● | Report filters by account, date, transfers in/out, include/exclude initial amounts, pending filter for bank transactions; custom date ranges. | S5, S25 |
| Organization | merchant intelligence (normalisation, logos, rules) | ◐ | Payees/companies with history and a Payees report; searchable brand/category icon library; auto-categorisation learns per merchant for bank imports. | S1, S5, S7 |
| Organization | notes | ● | Description field on transactions and transfers; Quick Notes guide exists. | S3 |
| Organization | attachments / receipts | ● | Scan Document, document picker (jpg/png/pdf) or Photo Library attached per transaction; no OCR auto-fill documented. App Store copy lists photo receipts under Premium. | S26, S20 |
| Spending / Money | accounts | ● | Multiple manual accounts, account grouping, show/hide accounts, default account, per-account currency fixed at creation. | S27, S28 |
| Spending / Money | credit cards | ● | Premium 'Credit Card' account type with balance, limit, available balance, payment-due and minimum-due; payments recorded as transfers from a checking account. | S29 |
| Spending / Money | statement cycles (closing/due dates) | ● | Opening date and payment due date configured per card; shows current billing cycle and future due dates; reminders. | S29 |
| Spending / Money | installments (cuotas) | ○ | Credit-card guide covers balance, limit, due dates and payments only; no instalment-plan concept anywhere in guides or features. | S29, S1 |
| Spending / Money | refunds | ● | Recommended as negative expenses in the original category (reduces category total); 12.1 added Reimbursement/Refunds default category. · 2nd reader: Guide confirms negative expense in the original category; the guide does not mention a Refunds category. The 'Reimbursement' default category comes fr… | S30, S10 |
| Spending / Money | early installment payoff | ○ | No instalment model exists, so no payoff flow; only credit-card payoff calculator on the website. | S29 |
| Spending / Money | recurring expenses | ● | Repeating transactions and transfers with interval, start/end date, marked 'R'; editable amounts; bank-imported transactions can be marked repeating. · 2nd reader: Confirmed: frequency (Day, Week 'and so on'), From date, end date or Forever, 'R' marker, repeating transfers, editing the amount for all future occur… | S31, S5, S32, S33 |
| Spending / Money | subscriptions | ● | 'Subscriptions & Bills' section (renamed in 11.3), Subscription Insights report, bill reminder notifications, Upcoming Bills widget, cancellation-letter generator on the… · 2nd reader: Confirmed (Subscription & Bills report and Subscription Insights on the reports page, Upcoming Bills widget in changelog 11.2/11.5.1, cancellation not… | S22, S15, S5 |
| Spending / Money | debts / receivables (personal loans) | ◐ | No debt account type: lent money is an expense with a debt category and the person as payee; repayments are income with the same payee; payee history shows what is outsta… | S34 |
| Spending / Money | multiple currencies | ● | Multi-currency accounts (Premium), main app currency, goal-specific currencies (11.4.3); AR FAQ names multi-currency as a Premium feature. | S28, S35 |
| Spending / Money | FX semantics | ◐ | Transactions are stored in the account's currency and totals are converted to the main currency for reports/balances using a live rate; the user can override the rate or… | S28 |
| Spending / Money | cash flow view | ● | Income vs Expense monthly report, Summary report, Monthly Living Costs; Overview cards per pay period. | S22 |
| Spending / Money | future commitments / upcoming payments | ● | Future-dated transactions toggle (include in balances or not), Subscriptions & Bills view, calendar with upcoming bills, Upcoming Bills widget, credit-card future due dat… | S36, S37 |
| Budgeting / Planning | total budget | ◐ | Classic budgets can be named custom budgets over any expenses; Daily Limit card estimates safe-to-spend from selected accounts and period; 12.1 'Remaining For Period' rep… | S38, S39 |
| Budgeting / Planning | category budgets | ● | Category Budgets (introduced 11.4, May 2026) per category/subcategory, monthly, Premium; Classic budgets remain free up to a limit. | S23, S5 |
| Budgeting / Planning | goals | ● | Smart Goals with target, optional deadline, manual or scheduled automatic deposits, required daily pace, per-goal currency, celebration on completion. · 2nd reader: Confirmed (target, optional deadline, manual or scheduled automatic deposits, daily pace) but Premium-gated per the goal guide and store copy; per-goa… | S40, S5, S41 |
| Budgeting / Planning | flexible vs fixed budgets / rollover | ● | Rollover toggle per category budget (carries unused or overspent amounts), top-up from monthly income, transfer between budgets, rebalance suggestions (Premium). | S23 |
| Budgeting / Planning | pay-cycle periods (custom month start / salary cycles) | ● | Payday Settings: fixed start day (1st, 15th, 25th, last day) or linked to a repeating salary transaction (weekly, biweekly, twice-monthly, monthly); reshapes Overview car… | S42, S5 |
| Budgeting / Planning | calendar view | ● | Calendar with daily totals, tap a day for its transactions, upcoming bills and planned future transactions, jump-to-today. | S37 |
| Budgeting / Planning | projections / forecasts | ◐ | Yearly Projection report forecasts net worth for the current year from spending patterns; Daily Limit and Remaining For Period are current-period pace calculations rather… | S22, S39 |
| Budgeting / Planning | reminders | ● | Bill reminders and Money Insights notifications; credit-card payment reminders. | S1, S29 |
| Reporting | by category | ● | Transactions By Category (pie), Category Insights with full history and trend, Top Categories. | S22 |
| Reporting | daily | ◐ | Calendar shows daily totals and Remaining For Period tracks daily balance vs pace; no dedicated daily report named. | S37, S9 |
| Reporting | trends over time | ● | Category Insights trend analysis, Net Worth progression report. | S22 |
| Reporting | period comparisons | ● | Live Activity expanded view compares the category against the previous period; Income vs Expense monthly comparison. | S13, S22 |
| Reporting | by merchant | ● | Payees report groups transactions by payee/company. | S22 |
| Reporting | subscriptions report | ● | Subscription Insights (cost over periods) and Subscriptions & Bills overview. | S22 |
| Reporting | calendar report | ● | Calendar view with daily totals and per-day drill-down (see calendar view). | S37 |
| Reporting | custom date ranges | ● | Custom report date range selection added in 11.3.3; Advanced Export supports custom periods. | S5, S25 |
| Reporting | AI-generated reports | ◐ | MoneyCoach AI (on-device Apple Foundation Models, iPhone 15 Pro+/M1+) shows personalised insights on the Overview; Mac sidebar AI entry; not a report generator. | S43, S5 |
| Reporting | explain / query financial data in natural language | ● | Siri with Apple Intelligence answers questions about the user's finances and can navigate the app (v12); net-worth queries via Shortcuts; on Mac a read-only MCP server le… | S5, S1, S18 |
| Collaboration | split expenses | ? (was ○) | Couples page says MoneyCoach does not split individual transactions and points to Splitwise; the developer sells a separate app, MoneySpaces, for shared spaces. · 2nd reader: The couples page does not state that MoneyCoach cannot split a transaction; its comparison table only characterises Splitwise as 'splitting expenses a… | S44, S45, S46 |
| Collaboration | equal split | ? (was ○) | No split feature in MoneyCoach. · 2nd reader: Follows split expenses: absence implied, not stated. | S44 |
| Collaboration | percentage split | ? (was ○) | No split feature in MoneyCoach. · 2nd reader: Follows split expenses: absence implied, not stated. | S44 |
| Collaboration | share-based split | ? (was ○) | No split feature in MoneyCoach. · 2nd reader: Follows split expenses: absence implied, not stated. | S44 |
| Collaboration | exact-amount split | ? (was ○) | No split feature in MoneyCoach. · 2nd reader: Follows split expenses: absence implied, not stated. | S44 |
| Collaboration | groups | ○ | Only in the separate MoneySpaces app (shared spaces, who-owes-who); MoneyCoach itself has Family Sync of one dataset, not groups. | S45, S47 |
| Collaboration | invitations / participants without accounts | ○ | Family Sync invitees need an Apple ID, MoneyCoach installed and Premium (or the Family Plan), same App Store region. | S47 |
| Collaboration | household / partner shared finances | ● | Family Sync: owner switches to a shared iCloud database and invites partner/family via Apple's sharing controller; all participants edit one dataset; everyone needs Premi… | S47, S48 |
| Collaboration | debt simplification | ? (was ○) | No split/settle-up engine in MoneyCoach; MoneySpaces page only mentions tracking who owes who. · 2nd reader: MoneySpaces page says that separate app tracks who owes who; no MoneyCoach page states a settle-up engine exists or is absent. | S45 |
| Automation | Apple Pay capture automation | ● | Shortcuts Wallet 'Transaction' automation, Run Immediately, in-person Apple Pay only (see Capture). | S11 |
| Automation | Mercado Pago sync | ○ | Bank coverage is 30 European countries only; no Argentina, no wallets outside the EU/EEA. | S49, S50 |
| Automation | bank sync (aggregator/open banking) | ● | GoCardless (PSD2, read-only), 2,798 banks in 30 European countries (Germany 1,090, Italy 403, France 138, Norway 140; UK excluded). Premium: 4 logins, Premium Max: 8. | S50, S49, S8 |
| Automation | imports (generic) | ● | CSV from any provider with field mapping that remembers earlier mappings; dedicated Apple Card statement import; Apple Pay via Shortcuts; manual backup restore. | S51, S52 |
| Automation | CSV import/export | ● | CSV import with column mapping (transfers need paired rows); CSV export with account, transfer and custom-period filters, plus PDF export; exports exclude budgets, attach… · 2nd reader: Gating correction: the guides do not gate export, but both App Store descriptions list 'advanced PDF and CSV export' (AR: 'Exportación avanzada a PDF… | S51, S25, S53, S10, S54 |
| Automation | Excel import/export | ○ | Import and export guides name CSV and PDF only. | S25, S51 |
| Automation | JSON import/export | ○ | Not among documented formats; backup files are an undocumented MoneyCoach format saved to Files/iCloud Drive. | S55 |
| Automation | notification-based automation (reading bank/payment notifications) | ○ | Capture paths are Shortcuts/Wallet, CSV and PSD2 sync; nothing reads device notifications (iOS does not allow it). | S1 |
| Automation | recurring detection | ● | User-controlled detection of repeating transactions in bank-synced accounts (11.1.3) and 'Mark as Repeating' for imported transactions. | S5 |
| Privacy / Platform | local-first / on-device data | ◐ | Manually entered data stays on device by default; iCloud sync is optional (Premium). Bank-synced data, subscription records and analytics (Firebase, Mixpanel) live on EU/… | S8, S56 |
| Privacy / Platform | account required or not | ○ (● = account required) | No login required; optional Sign in with Apple/email account exists for support and subscription features. · 2nd reader: Confirmed no login for manual use; nuance: the Sign in with Apple guide says a signed-in MoneyCoach user is required for online-banking features, and… | S1, S8, S57, S58 |
| Privacy / Platform | cloud sync | ● | Individual Sync via iCloud across iPhone, iPad, Mac, Watch, Vision Pro (Premium); Family Sync shared iCloud database. Conflict handling not documented. | S59, S47 |
| Privacy / Platform | iCloud / CloudKit | ● | Privacy policy states sync uses Apple CloudKit; automatic safety backup to the MoneyCoach folder in iCloud Drive before enabling sync. | S8, S55 |
| Privacy / Platform | Face ID / app lock | ● | PIN, Touch ID, Face ID; 11.5 extended the lock to cover the entire window. | S56, S5 |
| Privacy / Platform | hidden amounts (privacy mode) | ● | Incognito Mode hides sensitive app views; MCP has toggles to hide payees/descriptions. · 2nd reader: Confirmed (PIN, Face ID and Incognito Mode on the privacy page; MCP payee/description toggles on the MCP page) but Incognito Mode is listed as a Premi… | S56, S18, S53 |
| Privacy / Platform | Apple Watch | ● | Native watchOS app for quick checks (balances, remaining category budgets) and adding transactions; complications; watchOS 11.6+. · 2nd reader: Confirmed as a companion app for glanceable checks (balances, Category Budgets) and adding transactions; watchOS 11.6+ per App Store. | S60, S1, S20, S10 |
| Privacy / Platform | widgets | ● | Interactive Home Screen widgets, budget/goal/upcoming-bills widgets, tintable, Vision Pro widgets, Control Center controls. | S1, S16 |
| Privacy / Platform | accessibility (VoiceOver, Dynamic Type) evidence | ◐ | App Store accessibility section declares Larger Text (200%+), Dark Interface, Differentiate Without Color Alone and Sufficient Contrast; VoiceOver not declared. | S9 |
| Privacy / Platform | localization (languages, regions) | ● | 15 languages including Spanish and Arabic; community translation programme for tutorials; sold on AR and US storefronts with USD pricing. · 2nd reader: 15 languages confirmed on both storefronts. The translation guide describes a CSV correction-submission programme for app strings (not tutorials); a s… | S20, S61 |
| Privacy / Platform | Android availability | ○ | Android app deprecated and unsupported; separate ecosystem, no sync with Apple apps (CSV round-trip only). | S62 |
| Privacy / Platform | web availability | ○ | Apps page lists iPhone, iPad, Mac, Watch, Vision Pro only; homepage positions the absence of a web dashboard as a privacy choice. | S63, S58 |
| Monetization | free tier and its limits | ◐ | Free covers manual accounts, transactions, Apple Pay import, Classic budgets up to an unspecified budget limit, reports, goals, widgets, Watch. · 2nd reader: Note correction: goals are NOT free. The Smart Goal guide states 'Smart Goals are a Premium feature' and both store descriptions list Smart Goals unde… | S38, S35, S59, S20, S41, S10, S53, S64, S54 |
| Monetization | trial | ● | App Store subscription terms mention a free trial; Intelligence page advertises 'first month on us'. Length not stated on the pages read. · 2nd reader: Trial existence confirmed by the store fine print, the Family Plan guide (sharing waits until the trial ends) and the AR 12.1 release notes (trial rem… | S9, S7, S48, S53 |
| Monetization | monthly price | ◐ | App Store IAP list (USD on both storefronts; names are generic). AR: Individual USD 3.99 and 8.99 lowest, Premium Max USD 5.99. · 2nd reader: Re-read: AR lists Individual USD 3.99 and 8.99 as the lowest items and 'Individual Premium Max USD 5.99'; US lists Individual USD 4.99, 6.99, 9.99 and… | S20, S9, S65 |
| Monetization | annual price | ◐ | AR: Individual USD 26.99, 30.99, 53.99, 69.99; Family USD 43.99. US: Individual USD 49.99, 59.99, 69.99; Family USD 7.99 (presumably monthly). · 2nd reader: Re-read: AR Individual USD 26.99, 30.99 (listed twice), 53.99, 69.99; Family USD 43.99. US Individual USD 49.99, 59.99, 69.99; Family USD 7.99. | S20, S9 |
| Monetization | lifetime price | ● | Lifetime Premium USD 179.99 (AR storefront) and USD 199.99 (US storefront). | S20, S9 |
| Monetization | what Pro gates (the meaningful boundary) | ● | Premium: Category Budgets/top-up/transfer/rebalance, multi-currency, credit-card accounts, iCloud Individual Sync and Family Sync (every participant), bank sync up to 4 l… · 2nd reader: Add to the list: Smart Goals, unlimited accounts, Savings and Loan account types (credit-card guide: 'Credit Card, Savings, and Loan account types are… | S50, S18, S23, S48, S29, S10, S64 |
| Future Finance | savings goals | ● | Smart Goals with target, deadline, manual/automatic deposits, pace, per-goal currency. · 2nd reader: Same as goals: exists but Premium ('Smart Goals are a Premium feature'). | S40, S41 |
| Future Finance | investments | ○ | No investment or market-data features in the feature catalogue or reports; related products are separate apps (crypto ticker). | S1, S63 |
| Future Finance | net worth | ● | Net worth across multi-currency accounts, My Net Worth progression report, Yearly Projection, Siri net-worth query. | S22, S1 |
| Future Finance | loans / mortgages | ◐ | Mortgage handled as a repeating expense, a loan-style account paid by transfers, or a Smart Goal; no amortisation, interest or principal split. · 2nd reader: Confirmed partial, with one addition: a dedicated Loan account type exists (Premium) per the credit-card guide; the mortgage and property-loan guides… | S66, S67, S29 |
| Future Finance | assets (property, vehicles) | ? | Property-loan guide exists but no asset account type or valuation is documented on the pages read. · 2nd reader: The AR store description's 'Guardando cuentas' / US 'savings accounts' refers to a Savings account type, not property or vehicle assets; the 79-guide… | S66, S53, S68, S67 |
| Capture | in-app transaction templates (Smart Shortcuts / dynamic shortcuts) (added) | ● | From a transaction's details the user creates a Shortcut that reappears on the Overview Shortcuts card; a 'Dynamic' toggle lets amount or account be changed when run. | S69, S64 |
| Organization | bulk editing of transactions (added) | ● | Bulk transaction editing via context menu improved in 11.0.2, bulk-edit button fix in 11.0.1, bulk-edit fix in 12.0.2 release notes; categories can also be bulk-deleted. | S5, S21 |
| Organization | notes on goals and budgets (Quick Notes) (added) | ● | Quick Notes attach free text to goals, budgets and transactions; no gating stated. | S70 |
| Spending / Money | Savings and Loan account types (added) | ● | Besides normal and Credit Card accounts, the credit-card guide states Savings and Loan are Premium account types; the store descriptions list savings accounts under Premi… | S29, S10 |
| Automation | Apple Card statement import (added) | ● | Settings > Import & Export > Apple Card: Import takes the Wallet CSV and auto-categorises, adds descriptions and links payees; US users get a shortcut on the card. | S52, S54 |
| Automation | mark bank-imported pairs as transfers (added) | ● | 'Mark as Transfer' for internal online-bank transfers with selection of the matching transaction (11.0.1); pending bank transactions carry an orange badge and may need ma… | S5, S71 |
| Privacy / Platform | Mac keyboard shortcuts and menu-bar Shortcuts (added) | ● | Add expenses, incomes and transfers with keyboard shortcuts, full keyboard navigation guide, and Shortcuts runnable from the macOS menu bar; the Wallet Transaction trigge… | S19, S72, S12 |
| Monetization | Overview card customisation gated (added) | ● | Selecting, hiding and ordering Overview cards is a Premium customisation feature. | S64 |

Sources:

- S1: https://moneycoach.ai/features
- S2: https://moneycoach.ai/guides/how-to-use-quick-entry
- S3: https://moneycoach.ai/guides/how-to-add-description-tags-payee-to-transactions-transfers
- S4: https://moneycoach.ai/guides/how-to-add-transactions-with-siri-in-moneycoach
- S5: https://moneycoach.ai/changelog
- S6: https://apps.apple.com/us/app/moneycoach-budget-planner/id989642198?see-all=version-history
- S7: https://moneycoach.ai/moneycoach-intelligence
- S8: https://moneycoach.ai/legal/privacy-policy
- S9: https://apps.apple.com/us/app/moneycoach-budget-planner/id989642198
- S10: https://itunes.apple.com/lookup?id=989642198&country=us
- S11: https://moneycoach.ai/guides/how-to-import-apple-pay-wallet-transactions-to-moneycoach
- S12: https://moneycoach.ai/apple-pay-import
- S13: https://moneycoach.ai/blog/moneycoach-gets-live-activities-support
- S14: https://moneycoach.ai/guides/how-to-deactivate-live-activities
- S15: https://moneycoach.ai/best-subscription-manager-app-for-iphone
- S16: https://moneycoach.ai/guides/how-do-interactive-widgets-work-ios-17
- S17: https://moneycoach.ai/moneycoach-10-on-ios-18
- S18: https://moneycoach.ai/mcp
- S19: https://moneycoach.ai/best-budgeting-app-for-mac
- S20: https://apps.apple.com/ar/app/moneycoach-budget-planner/id989642198
- S21: https://moneycoach.ai/guides/getting-started-how-to-manage-categories-subcategories
- S22: https://moneycoach.ai/financial-reports
- S23: https://moneycoach.ai/category-budgets
- S24: https://moneycoach.ai/guides/how-to-merge-categories-subcategories
- S25: https://moneycoach.ai/guides/how-to-export-transactions-as-csv-in-moneycoach
- S26: https://moneycoach.ai/guides/how-to-scan-invoices-receipts
- S27: https://moneycoach.ai/guides/how-to-use-account-grouping
- S28: https://moneycoach.ai/guides/how-to-use-multi-currency
- S29: https://moneycoach.ai/guides/how-to-track-and-manage-credit-cards
- S30: https://moneycoach.ai/guides/how-to-handle-refunds-cashback-repayments
- S31: https://moneycoach.ai/guides/getting-started-how-to-use-the-repeating-transactions-feature
- S32: https://moneycoach.ai/guides/how-to-add-a-repeating-transaction-transfer
- S33: https://moneycoach.ai/guides/how-to-edit-a-repeating-transaction-amount-moneycoach
- S34: https://moneycoach.ai/guides/how-to-track-debts
- S35: https://moneycoach.ai/faqs
- S36: https://moneycoach.ai/guides/understanding-future-transactions-in-moneycoach
- S37: https://moneycoach.ai/guides/how-to-plan-better-using-the-calendar
- S38: https://moneycoach.ai/guides/getting-started-how-to-create-a-budget
- S39: https://moneycoach.ai/guides/how-does-the-daily-limit-works
- S40: https://moneycoach.ai/features/goals
- S41: https://moneycoach.ai/guides/getting-started-how-to-create-a-smart-goal
- S42: https://moneycoach.ai/guides/how-to-customize-your-payday-in-moneycoach-app
- S43: https://moneycoach.ai/blog/introducing-moneycoach-11-for-ios26
- S44: https://moneycoach.ai/best-budgeting-app-for-couples-iphone
- S45: https://moneycoach.ai/moneyspaces
- S46: https://moneycoach.ai/guides/getting-started-how-to-add-a-new-transaction
- S47: https://moneycoach.ai/guides/how-to-activate-family-sync
- S48: https://moneycoach.ai/guides/upgrade-to-family-plan
- S49: https://moneycoach.ai/bank-coverage
- S50: https://moneycoach.ai/online-banking
- S51: https://moneycoach.ai/guides/import-csv-files-in-moneycoach
- S52: https://moneycoach.ai/guides/how-to-import-apple-card-statements
- S53: https://itunes.apple.com/lookup?id=989642198&country=ar
- S54: https://moneycoach.ai/why-moneycoach
- S55: https://moneycoach.ai/guides/how-the-new-backup-restore-works
- S56: https://moneycoach.ai/privacy-first-budgeting-app
- S57: https://moneycoach.ai/guides/moneycoach-how-to-sign-in-with-apple
- S58: https://moneycoach.ai/
- S59: https://moneycoach.ai/guides/how-to-activate-cloud-sync
- S60: https://moneycoach.ai/best-budgeting-app-for-apple-watch
- S61: https://moneycoach.ai/guides/how-to-help-improve-moneycoach-translations
- S62: https://moneycoach.ai/guides/can-you-sync-moneycoach-android-and-mac-apps
- S63: https://moneycoach.ai/apps
- S64: https://moneycoach.ai/guides/how-to-customise-your-overview
- S65: https://moneycoach.ai/pricing
- S66: https://moneycoach.ai/guides/how-to-setup-a-mortgage-account-in-moneycoach
- S67: https://moneycoach.ai/guides/how-to-manage-property-loans
- S68: https://moneycoach.ai/guides
- S69: https://moneycoach.ai/guides/how-to-setup-dynamic-shortcuts
- S70: https://moneycoach.ai/guides/how-to-use-quick-notes
- S71: https://moneycoach.ai/guides/understanding-pending-transactions
- S72: https://moneycoach.ai/guides/how-to-integrate-shortcuts-app-with-moneycoach-on-macos
- S73: https://moneycoach.ai/support
- S74: https://moneycoach.ai/blog
- S75: https://moneycoach.ai/best-budgeting-app-for-iphone
- S76: https://moneycoach.ai/budgeting-app-without-bank-linking
- S77: https://moneycoach.ai/about-us/press-kit
- S78: https://moneycoach.ai/sitemap-0.xml
