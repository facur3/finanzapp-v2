# FinanzApp mobile: living roadmap

Updated: 2026-09-21. Read [decision 001](decisions/001-native-mobile.md),
[decision 002](decisions/002-spending-first.md) and
[decision 003](decisions/003-five-tabs-and-cards.md). Decision 002 supersedes earlier
full-finance migration phases and the local-only AI preference. Handoff entries
below are historical evidence, not current product priorities.

## Destination

An iOS spending/commitment app: fast capture, understandable spending, upcoming
payments and optional manually tracked accounts. No native investment portfolio,
market quotes or claim to know complete net worth. Cloud AI is opt-in, bounded and
server-keyed; manual recording and local data work without connectivity. Recurring
expenses, debts, budgets and cards remain in scope. Native navigation, accessible
amounts, real data and recoverable durable writes remain requirements.

## Status and current delivery — Producto 22

Implemented is code, checked names a test, device-verified needs a physical result,
and released means distributed. Neither a bundle nor a screenshot is App Store QA.

Producto 22 — AI Reachability & Native Material is a small product/UI phase: the
Assistant gets the most reachable persistent slot, and the two control surfaces gain
native Liquid Glass where iOS provides it. No financial semantics, no cloud.

- [x] **Centre tab.** Tabs are Inicio, Movimientos, **Asistente**, Reportes, Más. The
  Assistant screen is the tab root `(tabs)/assistant.tsx` (stays mounted, so the
  ephemeral conversation survives a tab switch; nothing is persisted; New chat is set by
  the screen through `Tabs.Screen` once a conversation exists). The Home quick action
  remains and uses `router.navigate`, so it switches to the tab instead of stacking a
  second conversation. Reachability: the bottom-centre slot is equidistant for the right
  and the left thumb and inside the comfortable zone on both small and large iPhones,
  whereas the Home row sits in the upper third, its leftmost action farthest for a right
  thumb and its rightmost for a left thumb; Dynamic Type does not move the tab.
- [x] **Tarjetas under Más.** `app/cards.tsx` is a pushed screen with its "+" in its
  own header; Más → Finanzas reads Cuentas, Tarjetas (graphite tile, live count of
  active cards), Presupuestos, Recurrentes, Deudas y cobros, Categorías. Card
  accounting, forms, detail and `router.replace('/cards')` after saving are unchanged.
  The Más → Asistente row is gone (it is a tab).
- [x] **Material policy** (`src/ui/material-policy.ts`, pure): glass only when
  platform is iOS, `isLiquidGlassAvailable()` (iOS 26+, Liquid Glass SDK), the runtime
  API is present (`isGlassEffectAPIAvailable()`, some iOS 26 betas lack it) and Reduce
  Transparency is off (live `AccessibilityInfo` subscription in `UIProvider`, defaulting
  to on until iOS answers). `expo-glass-effect@~57.0.3` is declared explicitly; it was
  already installed through expo-router and is in Expo Go's SDK 57 native modules, so
  no new native code and no Expo Go breakage. A throwing native module means opaque.
- [x] **Where glass is drawn.** Only two control surfaces, through `ControlSurface`:
  the four Home actions (regular glass, a cobalt wash on the Assistant, glyph colours
  unchanged, no ring on glass) and the Assistant composer bar (untinted regular glass;
  the field, the glyphs and the solid cobalt send button are the glass view's content).
  Press feedback stays the 0.97 scale: opacity is never animated on a glass view
  because the effect stops drawing at 0. `isInteractive` is off to avoid a second
  native bounce over ours.
- [x] **Where glass is deliberately not drawn.** Transaction, category and detail rows,
  grouped lists, Reportes cards, the segmented controls and filter pills (Todos / Gastos
  / Ingresos / Transf., Gastos / Disponible, Categorías / Día a día, ARS / USD; selected
  state stays the cobalt primary), the draft/evidence cards, the tab bar and headers
  (the JS tab bar keeps its opaque surface; a system UITabBar with native material is
  the native-tabs work of the development-build phase, not a custom glass overlay over
  react-navigation's bar).
- [x] **Composer geometry.** `composerBottomPadding(keyboard, inset, occupied)`: the
  bar measures what sits below the screen in window coordinates (the tab bar) and
  subtracts it, so it rests on the tab bar with the keyboard down and rises exactly to
  the keyboard when it opens; in a stack it clears the home indicator as before.
- [x] **Touch targets.** Each Home action is a flexing column (about 80 × 84 pt on a
  390 pt width, circle plus caption) with an 8 pt gap; no overlapping hit areas.
- [x] **Checked on Linux:** 271 mobile tests (7 new in `material.node.ts`, guards
  updated), TypeScript, Expo dependency check, `npm ls --all`, `npm audit` (0), Metro
  iOS export, 397 root tests, Vite build, repo hygiene.
- [ ] **Not device-verified:** whether Expo Go on the iPhone 14 Pro / iOS 26.6.1
  reports Liquid Glass available and how the glass reads over both backgrounds, the
  Reduce Transparency fallback flip at runtime, the composer resting on the tab bar and
  rising with the keyboard, the centre tab with VoiceOver and large text, Tarjetas from
  Más with its header "+".

### Previous delivery — Producto 21

Producto 21 — Assistant Experience makes the Assistant a first-class capability of the
product before the cloud model is connected: the real conversational interface, its
state model and its client boundary, with the disconnected state represented honestly.
No paid call, no Supabase project, no auth, no speech recognition, no autonomous write.

- [x] **Home affordance.** Four equal-width quick actions, Asistente first (sparkles on
  a cobalt wash with a thin cobalt ring), then Gasto / Ingreso / Transferir on a neutral
  opaque material (hairline edge; soft card shadow in light, a faint light edge in dark).
  Columns flex, captions may wrap to two lines under large text, VoiceOver labels stay
  full ("Abrir el Asistente"). Account detail keeps the three movements. No blur
  dependency: real Liquid Glass material is a development-build enhancement.
- [x] **Conversation model** (`apps/mobile/src/assistant/conversation.ts`): one
  ephemeral conversation (messages in local order: user / assistant / system, an
  assistant message carries optional structured content: answer, draft or
  clarification), a composer draft and a phase (idle / thinking / streaming). Pure
  reducer: send, delta, answer, fail, stop, choose, draft confirmed / cancelled / edited,
  note, reset. No persistence, no history product: chat history is a later capability.
- [x] **Draft principle.** A parsed sentence becomes a draft card (kind, amount, comercio,
  categoría with its tile, pagado con with the account tile, fecha) that the user
  confirms explicitly. `resolveDraft` never guesses a financially meaningful field: no
  kind → "¿Fue un gasto o un ingreso?"; no amount → asks for it; a payment method that
  matches one account by name is used, one eligible account is implied, otherwise
  "¿Con qué lo pagaste?" with the accounts of that currency as chips; no category →
  the user's most-used categories as chips. Confirmar is the only ledger write: the
  screen builds one Entry, the domain validates it, the repository saves it, a failed
  save keeps the draft and a retry reuses the same id. Editar opens the entry form
  prefilled and marks the card as edited; Descartar collapses it. Nothing is written by
  rendering, by a stale tap on a confirmed card, or in the fixture view.
- [x] **Evidence.** Answer rows and links come only from the cited `factIds` of the
  local `monthlyEvidence` (signed differences when both months cite the same label,
  absolute amounts otherwise; at most five rows); links open Movimientos, the category's
  dated expenses or Presupuestos. An id that is not local evidence renders nothing.
- [x] **Client boundary** (`src/assistant/client.ts`): event-based (`delta`, `result`,
  `error`) so a future token stream and today's single JSON reply render through the
  same code; `remoteAssistant` wraps the existing `integrationClient` (HTTPS origin,
  bearer session, strict contracts, 35 s timeout) and maps failures to reasons;
  `disconnectedAssistant` yields one `unavailable` without a request. `runtime.ts`
  chooses: this build is disconnected (no session provider exists yet); scripted
  fixtures only in a development bundle with `EXPO_PUBLIC_ASSISTANT_FIXTURES=1`.
- [x] **Screen** (`app/assistant.tsx`): quiet empty state ("¿En qué te ayudo?", four
  suggestions that disappear once a conversation starts), a FlatList that autoscrolls
  only when the reader is near the end, a composer that rides the keyboard on the UI
  thread (`useAnimatedKeyboard`), send disabled when empty and Stop while answering, a
  visible microphone that explains the development-build boundary, one calm caption
  when disconnected, New chat in the header. Haptics: light impact on send, success on
  a confirmed write, selection on a chip; none on open.
- [x] **Motion and accessibility.** New messages and cards rise 6 pt / fade only under
  Reduce Motion (`Appear`); the thinking dot pulses or stands still; every state is
  written ("Pensando…", "Respuesta interrumpida", "Borrador descartado"), never only
  coloured; VoiceOver labels on the field, microphone, send/stop, chips, links, draft
  rows and buttons; Dynamic Type caps the composer at about five lines.
- [x] **Checked on Linux:** 264 mobile tests (35 new across three files), TypeScript,
  Expo dependency check, Metro iOS export, 397 root tests, Vite build, repo hygiene.
- [ ] **Not device-verified:** keyboard tracking and interactive dismissal, the
  material of the four actions in both themes, the composer under large text, VoiceOver
  order through a conversation, the Reduce Motion behaviour of the pulse and reveals,
  the draft card and chips on the iPhone.
- [ ] **Next (Cloud/EAS phase):** mobile sign-in + consent, server origin configured,
  session provider wired into `assistantForEnvironment`, real token streaming from the
  endpoint, speech-to-text in the development build, chat history if wanted.

### Previous delivery — Producto 20

Producto 20 — Personalization gives financial objects a user-controlled visual
identity: custom categories and account identity, on one shared foundation. It is
not a redesign: the cobalt primary, the semantic colours, typography and motion stay.

- [x] **Category identity model** (`packages/domain/categories.ts`). `Entry.category`
  stays a free string and every consumer (reports, budgets, recurring rules, backups)
  keeps grouping by `categoryKey(string)`. Identity is `(kind, key)`. **Presets** live
  in code with label, icon and colour (nothing seeded). A **definition** row decorates
  one identity: `label` (display), `icon`, `color`, `archived`, and `storedLabel`, the
  exact string new movements record, fixed at creation so its key never changes.
  Renaming "Comida" to "Alimentación" keeps recording "Comida": old and new movements
  resolve to one identity and Reportes never splits one category in two. A string with
  no definition and no preset is **historical**: rendered as stored with a deterministic
  synonym glyph and one of the eight muted hues. `resolveCategory`, `categoryOptions`
  (picker: current value first even if archived, then recorded most recent first, then
  the catalogue, archived excluded), `categoryCatalog` (management list with usage) and
  `validateCategoryDefinitions` (unique identity; within a kind no display name can read
  as another definition or preset).
- [x] **Account appearance** (`packages/domain/appearance.ts`): `AccountAppearance` is
  a profile beside the account (`accountId`, `icon`, `color`, version), like a card or a
  debt profile. The `accounts` row, its audit and its backup shape are untouched; an
  account without a row shows wallet on cobalt (`accountLook`), so existing accounts
  migrate by reading, with nothing written. Curated ids: twelve account icons, 37
  category icons, eleven colours with accessible Spanish names and light/dark hex
  pairs (no expense coral). Invalid ids are refused on write/import and fall back on read.
- [x] **SQLite schema 8** (`MIGRATE_V8`): `account_appearances` (PK accountId, FK to
  accounts) and `category_definitions` (PK kind + key), additive, no rows, one exclusive
  transaction; an interruption leaves the schema 7 file untouched; idempotent.
  `createAccount(db, account, look?)` and `changeAccount(db, change, look?)` write the
  look in the same commit; `saveAccountAppearance` changes only the look (no account
  revision, no receipt); `saveCategoryDefinition` upserts one identity with stale-revision
  and stored-spelling checks and validates the whole collection.
- [x] **Backup v8** (`finanzapp.native-pilot.v8`): adds `appearances` and `categories`;
  every financial array is byte-identical to v7. v1–v7 files import as before; a v7 file
  cannot carry the new arrays; import is additive by account / identity, and a differing
  look or definition is a conflict, never an overwrite.
- [x] **Shared picker** (`src/ui/appearance-picker.tsx`): preview tile with the name,
  Icono as a grid of 44 pt round tiles, Color as a row of dots; the chosen tile fills with
  the chosen colour and gets a ring, the chosen dot a ring and a check; one selection
  haptic per change; colour-only transitions (0 ms under Reduce Motion); radio semantics
  with real names ("Banco", "Celeste"). Account and category forms share it.
- [x] **Account surfaces**: `AccountBadge` in Cuentas rows, account detail, both
  `AccountField` presentations and their sheets (Pagado con / Ingresa en, Desde / Hacia,
  recurring), movement detail (Cuenta row) and transfer detail (Desde / Hacia). Cards and
  debts keep their own glyphs. Colour lives in the tile only; rows, amounts and screens
  stay neutral. Nueva cuenta asks Nombre, Icono, Color, Moneda, Saldo inicial; Editar
  cuenta changes name, icon and colour (one commit with the correction when both change),
  currency stays immutable.
- [x] **Categories**: Más → Categorías lists Gastos / Ingresos (presets, custom and
  historical with usage) and an Archivadas group; "+" opens Nueva categoría (kind, name,
  icon, colour, available at once); tapping a row opens Editar categoría (name, icon,
  colour, Archivar / Desarchivar with confirmation). Every row shows the display name
  through the identity: rows, detail, picker, Home ranking, Reportes legend/donut/
  merchants, Presupuestos, recurring, drill-downs. No hard delete: archive-first.
- [x] **Default catalogue**: expense Comida, Supermercado, Restaurantes, Transporte,
  Combustible, Hogar, Alquiler, Servicios, Suscripciones, Salud, Farmacia, Educación,
  Ropa, Tecnología, Ocio, Viajes, Mascotas, Regalos, Impuestos, Seguros, Otros; income
  Sueldo, Trabajo, Ventas, Inversiones, Regalos, Reembolsos, Préstamos, Otros. A recorded
  odd spelling ("EDUCACION") now displays the preset label; the stored string is kept.
- [x] **Más**: Finanzas rows carry a soft tinted tile each (cobalt, teal, indigo, ochre,
  slate); App y datos stays neutral. Categorías shows the count of personalised ones.
- [x] **Assistant**: unchanged, still a preview under Más. Future direction is recorded
  under Next deliverables.
- [ ] Physical iPhone review: see the device checklist (picker touch/haptics, tiles in
  both themes, schema 8 upgrade on the real file, v8 backup, VoiceOver names).

Producto 20 verification adds domain tests (`appearance.test.ts`, `categories.test.ts`,
`recovery.test.ts` v8 round trip / v7 import / smuggling / conflicts), storage tests
(`database.node.ts`: schema 7 → 8 with interruption and idempotence, look create/edit/
retry with byte-identical financial data and no audit, category create/rename/archive
without rewriting entries/budgets/rules, v8 backup and v7 import, invalid ids refused),
and UI tests (`appearance.node.ts`: every glyph exists in the bundled Ionicons font,
palette contrast on surface and tint, fallbacks; `categories.node.ts`; `more-routes`;
`personalization-routes.node.ts`: account forms, category form, selectors, picker).

### Previous delivery — Producto 19

Producto 19 — Budgets 2 makes budgets a complete, financially coherent feature. A
budget is a planning limit; it never changes what a movement is. No visual redesign.

- [x] **Domain model** (`packages/domain/budgets.ts`): `MonthlyBudget` is a
  discriminated union on `scope`. A `total` budget has no `category` key at all; a
  `category` budget requires one (1–60 characters). `validateMonthlyBudget` rejects a
  total that carries any category, a sublimit without one, a zero or negative limit
  and an unknown scope. `budgetIdentityKey` is `currency|month|total` or
  `currency|month|category:<normalised>`, so the collection validator allows at most
  one active total per currency and month and keeps the existing one-active-sublimit-
  per-normalised-category rule; an archived predecessor never blocks a new one.
  `scopedMonthlyBudget` reads a legacy record (no scope) as a category budget.
- [x] **Total budget calculation**: `summarizeMonthlyBudgets` now returns `total`
  (progress of the active total against `totalSpentMinor`, every recorded expense of
  the month in that currency, exactly what Reportes counts: cash and card purchases
  once; never income, internal transfers, card payments, debt settlements or voided
  entries; other months and the other currency excluded) beside `rows` (category
  sublimits, worst first). `budgetedMinor` remains the sum of sublimits for their own
  line; it is never presented as the month's budget.
- [x] **States** live in the domain: `BUDGET_WARNING_RATIO = 0.85` and
  `budgetState(progress)` → calm below 85 %, warning from 85 % up to and including
  100 %, exceeded past the limit. The UI maps them to the existing neutral / warning /
  expense tones (`src/ui/budget-presentation.ts`); Reportes insights use the same rule
  and add "Superaste / Estás cerca de tu presupuesto general" first.
- [x] **SQLite schema 7** (`MIGRATE_V7`): `monthly_budgets` is rebuilt with
  `scope TEXT NOT NULL CHECK(scope IN ('total','category'))` and a nullable `category`
  with a CHECK tying it to the scope; every existing row is copied as
  `scope = 'category'` with id, category, currency, month, amount, active, createdAt,
  revision and updatedAt unchanged, then the old table is dropped and the new one
  renamed, all inside the existing exclusive migration transaction. Guarded by
  `user_version`, so it runs once and never on a v7 file; an interruption leaves the
  schema 6 table, its rows and the version untouched. A total is stored with
  `category NULL`; edits cannot change the scope or the currency.
- [x] **Backup v7**: `createRecoveryBackup` writes `finanzapp.native-pilot.v7`; a total
  budget serialises without a `category` key. `parsePilotBackup` accepts v1–v7: budgets
  in v5/v6 files have no scope and are read as category budgets, a v6 file cannot smuggle
  a scoped or total budget, and a v7 total with a category is refused.
- [x] **Form** (`src/ui/budget-form.tsx`): Tipo [General | Por categoría] first, then
  currency and the Interfaz 17 AmountField; General hides the category picker and
  explains the ceiling, Por categoría keeps the picker and says it is a sublimit that
  does not add to the general budget. Editing never shows the kind or currency
  controls. Same retry-safe submission and archive confirmation as before.
- [x] **Presupuestos screen** (`app/budgets.tsx`): with a general budget, a primary
  panel (Disponible or Excedido, bar, Gastado / Límite, "64 % utilizado" in its state
  colour, Editar) over a "Por categoría" list with its count caption; without one, a
  compact secondary "Agregar presupuesto general" action and the sublimits on their
  own. The old hero that summed sublimit limits is gone. Unbudgeted spending stays a
  footnote under the sublimits.
- [x] **Home** (`BudgetHomeCard`): with a general budget it leads with what is left of
  the ceiling, "de $X · 64 %" and how many sublimits are over; without one it shows
  the tightest sublimit (exceeded first) and the count of sublimits. Nothing sums
  sublimits. Home shows the module for a general budget alone, sublimits alone, and
  never for archived budgets.
- [x] Reportes lists "Presupuesto general" first in the Presupuestos block, then the
  sublimits. Entry form and movement detail keep the category context with the shared
  states. Currencies stay separate throughout: a USD budget sees only USD expenses.
- [x] Categories untouched: free strings and presets as before; "sjsjn"-style
  historical categories remain historical data. Custom-category CRUD is the next
  dedicated phase.
- [ ] Physical iPhone review: the Tipo control and the form in both kinds, the general
  panel and sublimit rows in calm / warning / exceeded, the compact "Agregar
  presupuesto general", the Home card with and without a general budget, Reportes
  insights, the schema 7 upgrade on the real pilot file (existing budgets identical
  afterwards) and a v7 backup export/import; VoiceOver, large text, Reduce Motion, both
  themes, Expo Go.

Producto 19 verification adds domain tests (`budgets.test.ts`: total over cash and
card purchases once, card payment / debt payment / income / voided / other-month /
other-currency exclusions, coexistence without summing, exceeded / exact 100 % /
approaching states, uniqueness, fake-category and non-positive rejection, legacy
records; `recovery.test.ts`: v7 round trip, v6 legacy budgets, smuggling refused;
`report-trend.test.ts`: total insights first), storage tests (`database.node.ts`:
schema 6 → 7 with hand-built v6 rows preserved exactly, interrupted migration,
idempotent rerun, CHECK enforcement, total persistence beside sublimits, duplicate
total, scope flip and currency flip refused, archive-and-replace, v7 backup and v6
import), and UI tests (`budgets-routes.node.ts` form, `polish-routes.node.ts` screen
hierarchy, `home-ranking.node.ts` Home card, `spending-home.node.ts` Home module
conditions, `budget-presentation.node.ts` states and headline).

### Previous delivery — Producto 18

Producto 18 — Navigation & Smart Actions is a product-architecture phase on top of the
stable Interfaz 17 visuals: no redesign, a clearer map of the app and faster financial
actions. Everything below is implemented and checked in Node; nothing is device-verified.

- [x] The fifth tab is **Más**, not Ajustes (`app/(tabs)/_layout.tsx`, glyph
  `ellipsis-horizontal-circle`). The primary bar stays at five: Inicio, Movimientos,
  Reportes, Tarjetas, Más. Presupuestos, Recurrentes, Cuentas and Deudas are not tabs.
  The route file keeps its historical name `settings.tsx`.
- [x] Más is a grouped native hub (`app/(tabs)/settings.tsx`): **Finanzas** — Cuentas,
  Presupuestos, Recurrentes, Deudas y cobros, Categorías; **App y datos** — Asistente
  ("Vista previa"), Copia de seguridad, Movimientos deshechos, with a footer line about
  local storage and the still-disabled sync. Tarjetas is no longer a Más row (it is a
  tab). Export/import moved to their own screen (`app/backup.tsx`, "Compartir e
  importar"), with the export code unchanged. Product judgment: no Preferencias row
  yet, because nothing would sit behind it; no disabled decorative rows.
- [x] Tarjetas contains only credit cards: the carousel, recorded debt, available
  credit, closing and due dates, Registrar compra / Pagar tarjeta and statement
  activity. The "Deudas y cobros" section was removed from the tab; the debts screen,
  debt detail, forms, data and accounting are untouched and reached from Más.
- [x] Transfer **Usar todo** (`src/ui/transfer-form.tsx`): under the amount, a footnote
  shows the source's recorded balance ("Saldo registrado: ARS 190.162,00") with a
  quiet text action that fills the field with the complete positive balance in the
  field's canonical display model ("190.162"; cents only when present). It is
  computed from the current records, respects ARS/USD, recalculates when Desde changes,
  offers nothing for a zero or negative balance, and never submits: the person still
  reviews, can edit downward and confirms. While editing an existing transfer the
  figure excludes that transfer's own effect. Idempotency and retry semantics are
  the existing ones (same operation ID; inputs lock after a failed save).
- [x] Card payment **Pagar total**: fills the recorded card debt, bounded by both the
  live debt and the caller's cap, so the shortcut can never propose a payment above
  the registered debt; a card in credit offers nothing. Editing upward past the debt
  is still refused on save. The payment stays one transfer (no second expense).
- [x] Personal debts **Saldar total** (I owe) and **Cobrar total** (they owe me): fill
  the current pending amount; one transfer per save, never an expense or income.
- [x] Home header no longer shows the sparkles Assistant shortcut. The Assistant stays
  reachable from Más as "Vista previa"; nothing claims a model is active. Home keeps
  contextual blocks only (budget when meaningful, upcoming commitments when real);
  no permanent navigation buttons were added.
- [x] Categories: the defaults are unchanged. Test-looking categories such as "sjsjn"
  and "JD" are not presets — the picker only knows preset labels plus the strings
  recorded on entries, so they come from historical entries on the device, and they
  keep working (offered first as recorded, never renamed). A read-only **Más →
  Categorías** screen lists the defaults and the recorded custom categories with their
  usage, so the origin is visible on the phone. No categories table, migration or
  backup bump in this PR; management/archive stays the next dedicated phase (below).
- [x] Visual system preserved: existing tokens and components; the only new piece is
  `AmountShortcut` (footnote + primary-coloured text action), used by the transfer form.
- [ ] Physical iPhone review: the Más tab and its two groups, Tarjetas without debts,
  Usar todo / Pagar total / Saldar total / Cobrar total on the device keyboard (the
  filled value, the caret at the end, editing after the fill), the Categorías list and
  the new backup screen; VoiceOver labels of the shortcut; both themes, large text,
  Reduce Motion, Expo Go.

Producto 18 verification adds `tests/smart-amounts.node.ts` (Usar todo in ARS and USD,
source-account change, zero/negative balance, Pagar total with live-debt and cap bounds,
Saldar total, Cobrar total, editing exclusion, retry lock and one operation ID, no
expense/income ever created), `tests/more-routes.node.ts` (Más groups, rows, pushes and
counts; backup screen; read-only categories screen), extends `tests/navigation.node.ts`
(Más title/icon, single Home header action, no sparkles), `tests/liabilities-routes.node.ts`
(Tarjetas renders no personal debts even with one recorded), `tests/categories.node.ts`
(historical custom categories intact next to intact defaults) and
`tests/money-input.node.ts` (`amountFromMinor`, integer round trip, no float).

### Previous delivery — Interfaz 17

Interfaz 17 gives the pilot a visual identity and a monetary experience of its own.
Interfaz 15 solved motion and Interfaz 16 solved hierarchy, but the dark UI was still
black, white and grey with the category hues as the only colour.

- [x] One brand primary, a cobalt blue (`src/ui/palette.ts`: light #2557D6; dark
  #5B87FF for text and selection, #3565EA under white button text), used only for
  interaction and selection: the selected tab, the selected label of every segmented
  control (Gastos / Disponible, Todos / Gastos / Ingresos / Transf., Categorías / Día
  a día, ARS / USD), links and section actions, the one filled call to action per
  screen, the account selector and picker checkmarks, the selected six-month bar and
  "Este mes". Normal text stays neutral. Every use is checked at 4.5:1 or better in
  `tests/theme.node.ts` for both themes.
- [x] Semantic colours stay separate: expense coral, income green, warning amber and
  the eight category hues are unchanged; transfer moved from the old link blue to a
  distinct azure (#0B6BB3 / #4DB0FF) so meaning and interaction never share a swatch.
  Secondary actions stay ink on the inset fill, so a screen has at most one blue button.
- [x] Home "En qué gastaste": one grouped surface with up to three ranked rows. Behind
  each row's content a rounded wash of its own hue (11 % dark, 8 % light), inset
  from the row's edges, runs from the left for exactly its share of the month (no
  invented minimum: 0,1 % is a hairline and the row stays fully tappable). No
  separators cut through it. Glyph tile, name, amount; no percentages, no line under
  the row. Washes grow from zero on first data (300 ms ease-out, 50 ms stagger) and
  interpolate on later data; Reduce Motion keeps a 200 ms fade only. The wash is an
  absolute, childless view on the UI thread; nothing is driven by scroll. (The
  owner's second iPhone review found the first version a heavy, square block of
  colour: four rows, a 20 % fill clipped by the surface edge and separators.)
- [x] Home quick actions are neutral circles with only the glyph in its semantic
  colour, so Home no longer reads as three coloured buttons.
- [x] Amount field box: the third iPhone review showed the caret overlapping the
  last digit of "3.000" (the native input sized itself around its text with
  negative tracking). The fourth review, recorded, showed the number jumping
  sideways per digit (the per-text box width re-centred the symbol + input group)
  and malformed values such as "300,00" when zeroes were typed quickly. The box is
  now stable: the input spans the row with fixed paddings and centres its text
  natively; the symbol is placed beside the text by arithmetic; only the font size
  changes, and only when the amount would not fit. No tracking.
- [x] Amount editing is a canonical state (sign, whole digits, decimal comma,
  fraction, logical caret), not a diff of display strings. The old common-prefix/
  common-suffix edit read the native text against the last rendered value; when a
  keystroke arrived before the controlled update had landed, the native text still
  held the previous unformatted digits, the diff attributed one of FinanzApp's own
  grouping dots to the user, and that dot became a decimal comma. Now digits and
  the comma in the native text are the truth, a dot is grouping unless it is
  explicit input (one more dot than the screen had, or a paste with its own
  separators), and the display text and display caret are rendered from the state
  and pushed as controlled `value` and `selection` from the change event's own
  caret; selection events that describe a text other than the shown one are
  ignored. Tested by a simulated native field: sequential typing 3 … 3.000.000,50
  with canonical value, display, logical and display caret at every step, repeated
  zeroes on a lagging native view, backspace at the end and around dots, insertion
  in the middle, selection replacement, comma and typed period, Argentine and US
  pastes, limits, negatives.
- [x] Category detail title clipping fixed: "Comida" lost its ascenders because the
  heading set a 26 pt size on the body variant's 22 pt line box. Headings now use the
  named title variants and `AppText` grows the line box when a style changes only the
  size. "Gastos del período" shares the report category header (tile, name, period).
- [x] Monetary input formats as the user types: "2000000" reads "2.000.000",
  "2000,5" reads "2.000,5", a typed period on an en-US keypad is a decimal separator,
  pasted "2,000.50" or "2.000.000,50" normalise, backspace over a grouping dot
  removes the digit before it, a selection can be replaced, two decimals at most,
  thirteen whole digits at most (the safe range), leading zeros vanish, blur
  completes "2.000,5" to "2.000,50". Presentation only: each change is read as an
  canonical edit state (`src/ui/money-input.ts`), the display string still goes
  through the domain's `parseMinorUnits` and the module contains no float. The
  caret is tracked explicitly as a logical position among the digits.
- [x] Hero amounts are one amount in three quiet levels: the currency symbol steps
  back to secondary and the cents to tertiary (same size, same baseline, one
  VoiceOver label); a coloured hero keeps its hue and lowers the alpha. Row amounts
  stay one plain string. The measured fit from Interfaz 16 is untouched.
- [x] Reportes colour refinement, not redesign: the selected month bar and label are
  the primary, the other bars graphite; "Dónde más gastaste" keeps its numbered rank
  and shows each merchant's category tile (no podium colours); "Para tener en cuenta"
  cards take 8 % of their category hue or semantic colour, a category fact shows its
  tile. Category and account selectors keep the Interfaz 16 hierarchy; the date row
  stays neutral.
- [ ] Physical iPhone review: the cobalt primary in both themes (tab, segmented
  labels, CTA, selectors), the tinted Home fills and their reveal, the formatted
  amount field (typing, backspace over a dot, paste, caret) in ARS and USD, hero
  colour levels, Dynamic Type at the largest size, Reduce Motion and Expo Go.

Interfaz 17 verification adds `tests/money-input.node.ts` (typing, comma and period
decimals, deletion, selection replacement, paste normalisation, limits, round trip
through `parseMinorUnits`, no floating point), `tests/theme.node.ts` (contrast of the
primary on every surface it is used on, of white on the filled button, semantic
separation from the primary) and `tests/home-ranking.node.ts` (honest proportions at
99,8 / 0,1 / 0,1 %, no percentage copy, staggered reveal, interpolation, Reduce
Motion, four-row limit), and updates the hero typography and selector tests.

### Future: card due-date reminders (not in this PR)

FinanzApp should eventually remind the user around a credit-card due date. It must
never claim "Todavía no pagaste tu tarjeta": the app is not bank-synchronised and
does not know whether a payment happened. Preferred language: "Visa Galicia vence
mañana", "Deuda registrada: $125.400", "Revisá si ya la pagaste." Tapping the
notification should deep-link to that card's detail / Pagar tarjeta flow. This
belongs to the notifications/native phase after the EAS development build.

### Previous delivery — Interfaz 16

Interfaz 16 is a subtraction pass after the owner's iPhone review of Interfaz 15: the
product direction was accepted, but the screens felt noisy and monochromatic.

- [x] Category identity is one object: the glyph tile takes the category hue (glyph
  in the hue, background a soft tint of it) in every row, legend, budget and detail.
  The detached colour dot is gone. Income and warning tones still override the hue.
- [x] Home is the current month: Gastos / Disponible, the currency control, one
  number and its month name (or "Saldo registrado" with the info button). No count,
  no date range, no week/month control; periods belong to Reportes. Three Wallet-style
  round actions (Gasto coral, Ingreso green, Transferir blue) replace the two filled
  buttons, so a transfer is one tap away. "En qué gastaste" is the top three
  categories as ranked rows with one 3 pt hue line each; "Ver N" opens Reportes.
- [x] Responsive financial typography: every amount is one line. A hero measures its
  container and takes the largest size (down to half its base) at which the whole
  string fits, computed from tabular glyph widths; on the reported iPhone
  "$ 999.999.999,99" renders at 40 pt and "US$ 999.999.999,99" at 34.5 pt. The native
  shrink-to-fit is no longer used on heroes: on iOS it also fits the measured height
  and collapsed long amounts to a few points (the defect the owner saw). Rows keep
  the native fit with a 3/4 floor. Dynamic Type is capped at 1.4× on heroes. The
  amount field steps 46 → 32 → 24 pt.
- [x] Forms keep the category identity: the chosen expense category shows its glyph
  on its hue in Registrar gasto, Editar movimiento, recurring and budget selectors and
  in the picker sheets; a chosen account takes the blue interaction accent; the date
  stays quiet. Home's category action reads "Reportes".
- [x] Tarjetas: identity (card) → state (debt) → three facts (Disponible with its limit
  as a caption, Cierre, Vencimiento) → primary Registrar compra → secondary Pagar
  tarjeta (same width, blue tint) → activity, whose caption carries the statement
  facts. The detail table (límite, emisor, moneda) and the two statement cards are gone.
- [x] Quieter screens: the bank/sync disclaimers, rule-restating footers and section
  captions were removed from Cuentas, the account detail, Presupuestos, Recurrentes,
  Deudas, Tarjetas and the movement detail. The account detail uses the same round
  actions as Home.
- [x] Tab bar: one selection tick when the section changes; no slide, no fade.
- [ ] Physical iPhone review: tinted tiles in both themes, hero amounts at 999.999.999,99,
  long merchant and category names, Dynamic Type at the largest size, the round
  actions, the card hierarchy and the tab tick.

Interfaz 16 verification updates the Home handler tests (month only, no count or range
copy, quick actions, ranking), the account and card detail tests (round actions,
facts row, stacked buttons, statement caption) and adds unit tests for the quick
actions, the hero fit (representative values, Dynamic Type, floor, the Money
component) and the form selector tints.

### Custom categories: model and plan (next dedicated phase, not in Producto 18)

Today a category is the trimmed string stored on each entry, recurring rule and
budget (1–60 characters, CHECK-constrained in SQLite); `categoryKey` normalises
accents, case and spaces for grouping; icons come from a keyword map and hues from a
stable hash. Arbitrary names already work: the picker offers recorded spellings first
and any typed text becomes a category on save. There is no categories table, so
nothing to rename or delete, and history references the string, not an id.

Safest model: a `categories` table (`key` = normalised string, `label`, `icon`,
`hue`, `archived`) that decorates the strings already stored. Renaming changes the
display label of a key; the recorded strings and their audit history never change.
Deleting archives the key (hidden from the picker, still shown on history). This
needs one additive migration (v7) and a backup format bump (v7) with the same
recovery tests as budgets; no rewrite of entries. UI: Más → Categorías (today a
read-only list of defaults and recorded categories with usage; then icon, colour,
name, + Nueva categoría and an edit sheet). It expands scope and storage, so it is
its own phase after the Producto 18 device review.

### Previous delivery — Interfaz 15

- [x] Motion system (`src/ui/motion.tsx`): one ease-out curve, named durations
  (press 100, release 160, state 200, data 260, enter 200, exit 100, reveal 480 ms),
  selection/impact haptic helpers, `ValueTransition` (the old value fades out in
  100 ms while the new one fades in over 200 ms, rising 6 pt; nothing plays on mount
  because tab roots stay mounted) and `Reflow` (siblings slide when a block appears
  or leaves). Reduce Motion keeps the opacity crossfades, drops the rise, the slides,
  the carousel depth and the chart reveal, and switches the native stack and sheets
  to fade.
- [x] Press treatments: `scale` (0.97 in 100 ms) for buttons, cards and chips;
  `highlight` (a translucent tint, like a table cell) for full-width rows, which never
  shrink; `opacity` (0.4) for bare text and icon buttons. Segmented control: one thumb
  slides between segments (interruptible), labels transition colour, a selection
  haptic ticks on change and re-tapping the current value does nothing.
- [x] Movement modal (`src/ui/movement-form.tsx`): Gasto / Ingreso / Transferencia is
  one control above one modal; switching is state, not navigation, so the thumb
  finishes, the haptic is truthful and the form below crossfades. The chosen account
  carries over. Card payments and debt settlements keep their own locked form.
- [x] Home: one tap moves at most three things. The hero crossfades on Gastos /
  Disponible, period and currency changes; the period row keeps its place under
  Disponible and only dims, so nothing below reflows; the recent list fades as one
  block. "En qué gastaste" is one stacked composition bar in category hues (drawn
  with transforms on the UI thread) plus the top three categories (name, amount,
  share) and a neutral "Otras N categorías" row that opens Reportes; the bar morphs
  when the same categories get new amounts and the block crossfades when the set of
  categories changes. The commitments block only exists with upcoming stored rules.
  The Disponible definition moved from on-screen copy to an information button.
- [x] Category colour: eight muted hues assigned per category key by hash with
  collision avoidance in order of first use, stable across Home, the donut and the
  legend; "Otras" stays neutral. Colour sits next to the name, never alone.
- [x] Reportes: the first donut sweeps in clockwise (static path is the finished arc,
  so a failed animated prop still shows the complete chart); a month or currency
  change is one crossfade with the slices already final, and the month title, its
  caption and the total crossfade together; month arrows, Este mes and trend bars
  tick a selection haptic; bar and label colours transition; budget insights sit on
  their tone tint.
- [x] Tarjetas: the carousel reads scroll position on the UI thread (no React render
  per frame); neighbouring cards step back to 0.94 scale / 0.7 opacity; the page dots
  transition; settling on another card ticks a haptic. The panel stays mounted and
  only its values crossfade, so the debts section below never jumps. Category and
  account pickers tick a haptic on a new choice. Presupuestos, drill-down and
  timeline bars use the shared data timing instead of their own durations.
- [ ] Physical iPhone review of the thumb slide, hero crossfade, donut sweep and
  carousel depth at 60/120 Hz, in both themes, with Reduce Motion on and off.

Interfaz 15 verification adds tests for the segmented thumb geometry, the carousel
index, the category palette (stability, distinctness, spelling, dark variant), the
donut sweep (finished static path, clock-hand order, first-time only, Reduce Motion),
the movement modal (mode switch as state, account carry-over, no navigation) and the
hosted entry form, and updates the Home handler tests (composition, hidden
commitments, no disclaimer copy, hue map, period row kept under Disponible).

### Previous delivery — Interfaz 14

- [x] Presupuestos: one hero (what is left or how far over), a total bar, spent and
  limit, a status line counting exceeded and near-limit categories, and dense rows
  with percentage, status text, spent of limit and one thin bar each. Month navigation
  says whether the month is current, closed or future.
- [x] Recurrentes: a 30-day projection per currency as three compact statistics
  (payments, due count, income), rows with frequency, next date, account, signed
  amount and "Hoy / Mañana / En N días", and the native switch to pause.
- [x] Cuentas: liquid accounts grouped by currency with each currency's recorded
  total in the section header; cards and debts stay in Tarjetas. Account detail shows
  the recorded balance, this month's recorded expenses and income, Gasto / Ingreso /
  Transferir, recurring rules and the opening balance, then its movements.
- [ ] Physical iPhone review of the budget rows, the switch and account actions.

Interfaz 14 verification adds handler tests for budgets (remaining, exceeded and
near-limit rows), recurring projection and pause, account totals per currency, account
detail statistics and the redirect of obligation accounts.

### Previous delivery — Interfaz 13

- [x] Reportes answers "¿a dónde fue mi plata?" for one month and currency: recorded
  total with daily average and the change against the same elapsed days of the previous
  month; a six-month bar trend (past months complete, current month through today,
  tapping a bar selects it); a category donut in an ink lightness ramp with a legend
  list (top five named, the rest grouped as Otras) and day-by-day view; budget status
  rows; top merchants by normalized identity; factual insights (over/near budget,
  largest expense, category that grew); recorded income, net cash flow (never called
  savings) and the previous-month comparison. Nothing is estimated or converted.
- [x] `react-native-svg` 15.15.4 (the Expo SDK 57 bundled version, Expo Go compatible)
  draws the donut; bars and progress use plain views.
- [ ] Physical iPhone review of the donut, bars and legend at large text and in dark mode.

Interfaz 13 verification adds domain tests for the monthly trend, top merchants,
daily average and insights, and report handler tests for the trend selection, donut
data and empty months.

### Previous delivery — Interfaz 12

- [x] Entry form hierarchy: Gasto / Ingreso / Transferencia switch (Transferencia hands
  off to the transfer form and back), a large amount tinted green for income, then two
  full-width selector cards that cannot be overlooked: Categoría (with the live budget
  line for that month when one exists) and Pagado con / Ingresa en (with the recorded
  balance or card debt, and the kind of each option in the sheet), then merchant and
  date. The save button echoes the amount. A card purchase says it counts once.
- [x] Transfer form: the same kind switch in plain mode; source and destination are
  selector cards with the resulting balance; a locked card or debt shows as a fixed
  card with its debt or pending amount. Recurring form uses the same selector cards.
- [x] No decorative Split, Receipt or Tags controls: they appear only when their data exists.
- [ ] Physical iPhone review of the form with the keyboard open, large text and VoiceOver.

Interfaz 12 verification adds form handler tests for the prominent selectors (labels,
live balance and card debt, budget line, amount echo, hand-off to transfers, debt
accounts never offered).

### Previous delivery — Interfaz 11

- [x] Compact Home: metric and currency controls in one row, an eyebrow + hero amount
  with the record count (and income when it exists), a week/month control under the
  hero, Gasto/Ingreso, one budget line (only when budgets exist), the top three
  categories with share, up to three upcoming commitments (with "Programar" when there
  are none) and the last four entries. The timeline bars left Home; analysis is in
  Reportes, linked from the categories block.
- [x] Movimientos: Todos / Gastos / Ingresos / Transf. filter, section labels Hoy · 20
  sep, Ayer, weekday within a week, then the date, and a per-day net of entries when
  the day has one currency (transfers excluded, never mixed currencies).
- [x] Transaction detail: tile, signed amount, merchant, full date and a status line;
  category, account or card (linking to the card), budget context only when an active
  budget matches that month/currency/category, currency; edit and undo. Transfer
  detail names card payments, debt payments and collections and links to the
  obligation. No fabricated bank data.
- [ ] Physical iPhone review of the Home density, section labels and detail layout.

Interfaz 11 verification adds presentation tests for the transfer filter, section
labels and day nets, Home handler tests (no timeline, Reportes link, Programar,
Disponible excluding a card) and a detail test for budget context.

### Previous delivery — Interfaz 10

- [x] Five tabs with one meaning each: Inicio, Movimientos, Reportes, Tarjetas, Ajustes.
  Reports and cards are no longer links buried in Home or Settings; Recurrentes is
  reachable from Home's Próximos compromisos even when empty, and from Settings.
- [x] Credit cards and personal debts as hidden internal accounts (SQLite schema 6):
  a card purchase is one expense that raises the card debt; a card payment is a
  transfer that lowers cash and debt; debts/receivables settle through transfers.
  Expenses, income and recurring rules on a debt account are refused in storage.
- [x] Home Disponible excludes cards, debts and receivables; backup v6 carries card and
  debt profiles; v1–v5 files still import. Import preview totals are liquid money.
- [x] Wallet-inspired Cards tab: snapping carousel, recorded debt, available limit,
  closing/due dates from user-entered days, statement purchases/payments, recent
  activity, debts/receivables; card and debt detail; contextual card payment and
  debt settlement forms capped at the outstanding amount.
- [x] Neutral ink-first visual system with semantic expense/income/transfer/warning
  colours, glyph tiles instead of emoji, native segmented controls and an ink tab bar.
  Purple is retired. See [visual direction](mobile-design.md).
- [ ] Physical iPhone review of the carousel, palette contrast and large text.
- [ ] Home, Activity, transaction detail, entry forms, Reports, Budgets and Recurring
  redesigns on the new system (next phases below).

Interfaz 10 verification uses the same CI gates. It adds domain tests for card and
debt accounting, calendar cycles and v6 recovery; real temporary-SQLite tests for the
5 → 6 migration (including interruption), retry-safe card/debt creation, purchase and
payment double-count guards, debt posting refusal and v6 import; and route-handler
tests for the Cards tab, card/debt detail, the locked payment transfer and the entry
form account scope. Physical iPhone layout/gesture/frame pacing remains a separate gate.

SQLite is now schema 6. Schema 5 monthly_budgets remain intact and schema 6 adds
credit_cards and personal_debts with unique internal-account references. Existing
schema 1–5 data migrates in place; no reset, bank connection or remote migration is
part of this delivery.

### Audit of the previous WIP branch (feat/mobile-cards-liabilities)

The branch modelled cards and debts correctly (hidden accounts, purchase once,
payment as transfer) but was not finished: no domain, SQLite or route tests; the
recovery test still expected v5 so its own suite would have failed; cards and debts
were registered as routes but unreachable from any screen; a debt account could be
posted to from the expense form, recurring form and entry edit; backup preview
totals still counted card debt as available money; and the hidden accounts leaked
through the generic account detail. Interfaz 10 reused its domain/storage shape
(so any device that ran the branch keeps schema 6 compatibility) and rebuilt the
surfaces, guards and tests around it rather than merging it as-is.

### Previous delivery — Interfaz 09

- [x] Spending-first Home: week/month, separate currencies, recorded expense total.
- [x] Exact chart buckets, category and date drill-downs; scoped recent entries.
- [x] Original warm-white/ink/indigo visual direction inspired by supplied references.
- [x] Accounts stay accessible from the header/Settings; initial balance optional.
- [x] Home explicitly toggles Gastos / Disponible: spending is period consumption;
  available is only the recorded balance of accounts in the selected currency.
- [x] Monthly category budgets with remaining/exceeded state, future months, ARS/USD
  separation, reversible archival and exact expense-only consumption.
- [x] A visible Assistant preview is reachable from the Home toolbar without pretending
  cloud AI is active or placing an action button in the three-section tab bar.
- [x] Native recurring expense/income rules: weekly/monthly/yearly, edit/pause/reactivate,
  stable end-of-month anchors and deterministic per-occurrence identity.
- [x] Due occurrences are materialized atomically on open/resume; retries/restarts cannot
  duplicate the posting. Paused dates are not silently backfilled on reactivation.
- [x] Real upcoming commitments appear on Home only when stored active expense rules exist.
  The dedicated screen adds a 30-day ARS/USD-separated forecast with Reduce Motion support.
- [x] Native v5 backup/import includes recurring rules and monthly budgets while retaining v1-v4 restore support.
- [x] Remove obsolete MonthCard, duplicated monthly flow block and balance-hero colors.
- [x] Cloud contracts, mobile client/evidence builder, disabled API routes and
  Responses provider adapter. No AI key in app, paid request or cloud data migration.
- [x] Staging SQL inbox with owner isolation, unique events and durable daily quotas.
- [ ] Activate/test the integrations with real staging auth, consent and owned keys.
- [ ] Physical visual/gesture review on iPhone. The user accepted only the initial
  Expo Go pilot; later interface iterations have not received device approval.

Interfaz 09 verification is enforced by the same CI gates: root/domain tests and
build, repository hygiene, isolated PostgreSQL tests, mobile dependency integrity,
Expo compatibility, TypeScript, real temporary-SQLite tests and iOS JS/Hermes/assets
export. The feature adds calendar edge-case, migration, rollback, restart, retry,
pause, budget migration/retry and v5-backup coverage. Physical iPhone layout/gesture/frame pacing remains a
separate acceptance gate; automated handlers are not UIKit evidence.

Interfaz 09 shipped schema 5 (monthly_budgets). No private data, test fixture, ZIP
artwork or financial screenshot is added to user data or published as a product
asset. The old web/Capacitor product and data remain available; its used features
are not dead code.

## Next deliverables, in order

Interfaz 10 sequences the product/visual work as focused pull requests, each gated
by CI and merged into master before the next starts:

1. ~~Home redesign~~ — delivered in Interfaz 11.
2. ~~Movimientos and transaction detail~~ — delivered in Interfaz 11.
3. ~~Entry forms~~ — delivered in Interfaz 12.
4. ~~Reportes~~ — delivered in Interfaz 13. Account and custom period filters remain backlog.
5. ~~Presupuestos, Recurrentes and Cuentas polish~~ — delivered in Interfaz 14.
   Installments and statement periods for cards, with proper calendar semantics, remain.
6. ~~Motion system, Home composition and category colour~~ — delivered in Interfaz 15.
7. ~~Native visual cohesion and information hierarchy~~ — delivered in Interfaz 16.
8. ~~Visual identity and monetary experience~~ — delivered in Interfaz 17.
9. ~~Custom categories and account identity~~ — delivered in Producto 20 (definitions
   decorating stored strings, display rename, archive-first, schema 8, backup v8).
10. ~~Assistant experience~~ — delivered in Producto 21 (four Home actions with
    Asistente first, the conversational screen, composer with a visible voice
    affordance, streaming-ready state model, suggestions, draft cards with explicit
    confirmation, clarification chips, evidence rows and links, disconnected state).
    No Supabase, auth or cloud sync is wired in the app yet; the local SQLite ledger
    remains the source of truth and activation is the next phase.
11. ~~AI reachability and native material~~ — delivered in Producto 22 (Assistant
    centre tab, Tarjetas under Más, Liquid Glass on the two control surfaces with the
    opaque fallback). Producto 23 is the real cloud/text Assistant activation.
12. **EAS development build and Apple integrations** (Face ID, notifications with
    the card due-date reminder, Apple Pay capture, App Intents) only after the core
    product is stable on device.

### 1. Complete the daily tracking loop

- [ ] Review Interfaz 07 on device: small canceled swipes, large text, both themes,
  tiny amounts/long names, Monday/month boundaries and 30–40 tab changes.
- [ ] First-entry onboarding without requiring a named account; preserve current
  recorded-account semantics rather than inventing a bank balance.
- [x] Budgets by month/category, explicit remaining budget and exceeded state.
- [x] Recurring expenses/income and subscriptions: next occurrence, pause/edit and
  per-occurrence identity. Scheduled is not paid; retries cannot duplicate.
- [x] A small upcoming-payments block only when there is actual stored recurring data.
- [ ] Local reminder opt-in/timezone/deduplication; keep notification content private by default.

### 2. Activate smart capture and explanations

Use [integration contracts](mobile-integrations.md) as the implementation boundary.

- [ ] Staging Supabase setup, mobile sign-in and cloud-data consent; no login needed
  for the local core. The existing web snapshot is not a mobile sync engine.
- [x] Text assistant UI (Producto 21: conversation, drafts, clarifications, evidence,
  disconnected state). [ ] Audio/transcription with explicit mic permission, limits and
  deletion (development build). Review/edit/undo with no phantom success or discarded draft.
- [ ] Evaluate Spanish phrases, ambiguous categories, currencies, loans/refunds,
  questions and failure handling with owned test data and measured provider usage.
- [ ] Safe auto-registration opt-in only for complete supported operations and
  owned account/card mappings. Ambiguous messages stay drafts.
- [ ] Scoped/revocable Shortcut pairing token; current base endpoint uses session
  JWT and is not a turnkey background Shortcut integration.
- [ ] Durable inbox → SQLite receipt → acknowledgement, repeated delivery after
  edits/deletions and cross-device conflict tests before autonomous ingestion.
- [ ] Actual iPhone Apple Pay transaction trigger, available fields, missing amount,
  duplicate triggers, offline catch-up and cancellation verified without bank execution.
- [ ] Explain only deterministic facts, disclose partial records, and link supporting
  movements. Savings plans need goals/timeframe and explicit assumptions.

### 3. Commitments and cards

- [ ] Debo / me deben, due dates, partial payments and recoverable history.
- [ ] Loan principal is separate from income/consumption; interest/fees have categories.
- [ ] Debit/credit payment method, purchase, installments and due date.
- [ ] Purchase counted once; installment/payment reduces obligation without a second
  expense. Early payment removes that amount from later scheduled payments.
- [ ] Cash outflow, recorded expense and future commitment have distinct labels.
- [ ] No native FCI redemption, broker portfolio or simulated bank/card payment.

### 4. Independent build, Apple and optional sync

- [ ] Link owner's EAS project and enroll Apple when ready for a signed preview;
  the Expo Go design/ledger step does not need a paid build.
- [ ] Local reminders with opt-in time/timezone/deduplication; no amounts by default.
- [ ] Face ID/passcode fallback, background privacy and native data protection.
- [ ] App Intents/widgets/Apple sign-in after signed-device evidence.
- [ ] Optional normalized Supabase sync: outbox, revisions, tombstones, RLS, conflict
  handling and user/session isolation. Reuse durable local operation IDs.
- [ ] Data export/deletion/recovery and provider privacy/retention before cloud release.
- [ ] TestFlight performance/accessibility, subscription economics, StoreKit/restore,
  policy/support/privacy metadata and App Store submission after the release gate.

Legacy import stays optional backlog. Do not require JSON or full portfolio re-entry.
Keep native backup/recovery, integer cents, no fake FX, no silent reset and original
unrelated work. Never merge all branches indiscriminately or enable costs by accident.

## Motion and design rules

One main number, real chart values, calm hierarchy and contextual actions. Native
stack/sheets own transitions. Preserve the mounted-tab mitigation; do not reintroduce
focus fades, detach/freeze combinations or redirect-based back handling. Motion is
driven by data or touch, never by a screen gaining focus: use `src/ui/motion.tsx`
(ease-out, named durations, `ValueTransition`, `Reflow`, haptic helpers) instead of
ad-hoc timings. Brief press, selection and data-change animations respect Reduce
Motion; text and financial values are never hidden until an animation finishes. One
haptic per user action, always paired with a visual. Category hues come from
`src/ui/category-color.ts` and never replace a name. Colour tokens live in
`src/ui/palette.ts`: the cobalt primary marks interaction and selection only, the
semantic colours carry meaning, normal text stays neutral, and any new use of the
primary must keep 4.5:1 (see `tests/theme.node.ts`). Money input goes through
`src/ui/money-input.ts` and the domain parser; never format with floats. 44-point
targets, VoiceOver, safe areas, system text and separate currencies apply to every
new screen.

## Handoff log (historical evidence)

### 2026-09-21 — Producto 22: AI reachability and native material

- Assistant as the centre tab (tab root, Home action navigates to it), Tarjetas moved
  from the bar to Más → Finanzas as a pushed screen with its header action, a pure
  material policy plus `ControlSurface`, native Liquid Glass through `expo-glass-effect`
  (already bundled in Expo Go SDK 57) on the four Home actions and the composer only,
  opaque Producto 21 material everywhere else and whenever any condition fails, Reduce
  Transparency subscription, tab-bar-aware composer padding. No financial change.
- **Checked on Linux:** 271 mobile tests, TypeScript, Expo dependency check, dependency
  tree and audit, Metro iOS export, 397 root tests, Vite build, repo hygiene.
  **Not device-verified:** glass availability and look, Reduce Transparency flip,
  composer over the tab bar and keyboard, centre tab with VoiceOver and large text.

### 2026-09-21 — Producto 21: Assistant experience

- Four equal-width Home quick actions with Asistente first on a restrained opaque
  material (no blur dependency), the real Assistant screen replacing the brochure
  preview (suggestions, composer with mic/send/stop riding the keyboard, streaming and
  thinking states, draft cards with Confirmar / Editar / Descartar, clarification chips,
  evidence rows and links, calm disconnected / offline / limit / failed notes, New chat),
  a pure conversation reducer, an event-based client boundary wrapping the existing
  integration client, a disconnected runtime, scripted fixtures gated to development
  bundles, entry-form prefill for Editar, `successHaptic` and `Appear` in the motion
  module. Backend, contracts and evidence builder reused, not changed; nothing activated.
- **Checked on Linux:** 264 mobile tests (Node SQLite, route and source harnesses),
  TypeScript, Expo dependency check, Metro iOS export, 397 root tests, Vite build, repo
  hygiene. **Not device-verified:** keyboard tracking, material in both themes, VoiceOver
  order, Reduce Motion, Dynamic Type in the composer and on the four captions.

### 2026-09-21 — Producto 20: custom categories and account identity

- Category identity model (presets in code, definitions per kind + normalised key,
  display rename with a fixed stored spelling, archive-first), account looks as a
  profile beside the account, SQLite schema 8 (two additive tables, nothing seeded),
  backup v8 with v1–v7 compatibility, one shared icon/colour picker, account identity
  across Cuentas, detail, selectors and detail rows, category management (create, edit,
  archive), tinted Más → Finanzas tiles. Assistant untouched (preview under Más).
- **Checked on Linux:** 397 root tests (vitest), 229 mobile tests (Node SQLite, route
  and source harnesses), TypeScript, Expo dependency check, `npm ls --all`, Metro iOS
  export, Vite build, repo hygiene. **Not device-verified:** picker gestures/haptics,
  tiles in both themes and Dynamic Type, schema 8 upgrade on the real pilot file, v8
  share/import on iOS, VoiceOver reading of the picker.

### 2026-09-21 — Producto 19: monthly total budget and category sublimits

- Scoped budget model (total | category) with no fake category, one active total per
  currency and month, SQLite schema 7 (table rebuild that preserves every existing
  budget as a category budget), backup v7 with v5/v6 compatibility, shared budget
  states, a scoped form, a hierarchical Presupuestos screen, a total-first Home card
  and total insights in Reportes. Sublimits are never summed into a monthly figure.
- Checked locally: TypeScript, 199 mobile tests (13 new), root domain/web tests
  (368, 12 new), Vite build, hygiene, Expo compatibility and Metro iOS export. No
  device evidence; the real pilot file has not been migrated yet.
- Edge cases recorded: exactly 100 % is "límite alcanzado" (warning, not exceeded); a
  general budget alone shows an explicit "sin límites por categoría" line; an archived
  total lets a replacement be created and keeps the archived row in history; a stale
  revision, a scope flip or a currency flip on edit are refused without changes.

### 2026-09-21 — Producto 18: navigation and smart actions

- The fifth tab became Más, a grouped hub (Finanzas / App y datos) with the backup
  export/import on its own screen and a read-only Categorías list; Tarjetas lost the
  personal-debts section (data and screens untouched, reached from Más); the Home
  sparkles shortcut was removed while the Assistant is a preview. The transfer form
  gained one contextual shortcut: Usar todo (positive source balance), Pagar total
  (recorded card debt, capped), Saldar total and Cobrar total (pending obligation),
  all fill-only through the amount field's canonical display model.
- Checked locally: TypeScript, 186 mobile tests (18 new), root domain/web tests (359),
  Vite build, hygiene, Expo compatibility and Metro iOS export. No device evidence.
- Edge cases recorded: a zero or negative source balance offers no "all" (figure still
  shown); a card in credit offers no Pagar total; a stale, larger `maxAmountMinor`
  cannot raise the fill above the live debt; while editing a transfer the "all"
  excludes that transfer's own effect; the shortcut is disabled while a failed save is
  locked for retry. Usar todo can still leave the source at exactly zero and, after a
  manual edit upward, negative (warned, allowed, as before). Cross-currency stays
  refused. The categories "sjsjn" / "JD" cannot be verified from Linux (the SQLite file
  lives on the iPhone), but the code has no other source for them than recorded entries.

### 2026-09-21 — Interfaz 17: visual identity and monetary experience

- A cobalt brand primary for interaction and selection (tab, segmented labels,
  links, one filled CTA per screen, account selector, selected month bar), transfer
  moved to a distinct azure, category hues untouched. Home "En qué gastaste" became
  one grouped distribution with tinted fills behind the rows (honest shares,
  staggered reveal, Reduce Motion fade). The amount field formats Argentine grouping
  while typing through an edit-aware pure module; values still parse to integer
  minor units. Hero amounts got three colour levels in one string. Reportes merchants
  show their category tile and insight cards take an 8 % tint.
- Checked locally: root domain/web tests, TypeScript, Vite build, hygiene, 161 mobile
  tests (money input, theme contrast, Home ranking, hero typography, selector tints),
  Expo compatibility and Metro iOS export. No device evidence: caret behaviour of the
  formatted field, the tinted fills and the cobalt in both themes need the iPhone.
- Pre-merge polish after a second iPhone review: the Home category fills became
  faint, inset, rounded washes on three rows without separators; the quick actions
  became neutral circles with semantic glyphs; the clipped category title (a large
  size on the body line box) was fixed in `AppText` and every large heading moved
  to the named title variants. 162 mobile tests.
- Third review: the amount field's caret overlapped the last digit of "3.000".
  Root cause: the native input sized itself around its text with negative tracking.
  The box is now pure geometry from the row width with padding and caret room,
  tested per display string and caret position. 164 mobile tests.
- Fourth review, recorded on the iPhone: the number jumped sideways as digits and
  dots arrived, and fast zeroes produced "300,00"-style values. The per-text box
  width was replaced by a stable row-wide box with fixed paddings and an
  arithmetically placed symbol; the display-string diff was replaced by a canonical
  edit state with an explicit, logically mapped caret driven by the change event's
  own selection. A simulated native field, including a lagging one, covers the
  device sequence. 168 mobile tests.

### 2026-09-20 — Interfaz 16: native visual cohesion and information hierarchy

- Category hue inside the tile, month-only Home with round actions and ranked
  categories, one-line responsive amounts everywhere, a card hierarchy of identity →
  state → facts → primary → secondary → activity, disclaimer and footer copy removed,
  a tab-change tick. Custom categories investigated and planned as Interfaz 17.
- Pre-merge defect pass after a second iPhone review: the hero amount collapsed on
  long values (native shrink-to-fit fitting the measured height); replaced by a
  measured, deterministic fit. Category hue carried into the form selectors and
  picker sheets; account selector on the blue accent; Home link renamed Reportes.
- Checked locally: 359 domain/web + 140 mobile tests, TypeScript, Vite build, hygiene,
  Expo compatibility and Metro iOS export. No device evidence.

### 2026-09-20 — Interfaz 15: motion system, Home composition and category colour

- One motion module (ease-out, named durations, haptic helpers, value crossfade and
  reflow), a sliding segmented thumb, Home hero transitions and composition bar,
  category hues shared by Home and Reportes, a clockwise donut sweep, a UI-thread card
  carousel with depth and a crossfading card panel. No new dependency.
- A second pass after a motion review: Transferencia became a mode of one movement
  modal, Home fires at most three motions per tap, Reduce Motion keeps fades, exits
  ease out in 100 ms, the composition bar draws with transforms and crossfades on a
  category-set change, the donut sweeps once and crossfades afterwards, Reportes
  title and total move together, the card panel stays mounted, rows highlight
  instead of shrinking, and hard-coded durations use the shared vocabulary.
- Checked locally: 359 domain/web + 135 mobile tests, TypeScript, Vite build, hygiene,
  Expo compatibility and Metro iOS export. No device evidence: motion feel, haptic
  timing and the animated SVG path in Expo Go still need the iPhone.

### 2026-09-20 — Interfaz 14: Presupuestos, Recurrentes and Cuentas polish

- Dense budget rows with percentage and one thin bar; 30-day recurring statistics;
  per-currency liquid totals in Cuentas; account detail with month in/out and actions.
- Checked locally: 359 domain/web + 129 mobile tests, TypeScript, Vite build, hygiene,
  offline Expo compatibility and Metro iOS export. No device evidence.

### 2026-09-20 — Interfaz 13: Reportes analytics

- Trend, donut, legend, day-by-day, budgets, top merchants and insights on one tab;
  every figure is recorded spending in the selected currency.
- One new dependency: react-native-svg at the SDK 57 bundled version.
- Checked locally: 359 domain/web + 125 mobile tests, TypeScript, Vite build, hygiene,
  npm ls, offline Expo compatibility and Metro iOS export. No device evidence.

### 2026-09-20 — Interfaz 12: entry, transfer and recurring form hierarchy

- Forms lead with kind and amount, then Categoría and Pagado con / Ingresa en as
  full-width cards with live context (balance, card debt, month budget). Transfers
  and recurring rules share the pattern; obligations stay locked in payment mode.
- Checked locally: 355 domain/web + 124 mobile tests, TypeScript, Vite build, hygiene,
  offline Expo compatibility and Metro iOS export. No device evidence.

### 2026-09-20 — Interfaz 11: compact Home, Movimientos and transaction detail

- Home lost the timeline bars and the empty budget card; it keeps one hero, compact
  controls, budget line, top categories, upcoming commitments and recent entries.
- Movimientos filters transfers, labels sections by relative day/weekday and shows a
  single-currency day net. Detail screens follow the Wallet hierarchy with only stored facts.
- Checked locally: 355 domain/web + 123 mobile tests, TypeScript, Vite build, hygiene,
  offline Expo compatibility and Metro iOS export. No device evidence.

### 2026-09-20 — Interfaz 10: five tabs, cards/debts accounting and neutral visual system

- Tabs: Inicio, Movimientos, Reportes, Tarjetas, Ajustes; mounted-tab mitigation kept.
- Cards and debts are hidden internal accounts with profiles. Purchase = one expense,
  payment = transfer; debt settlement = transfer; storage refuses postings on debts.
- Home Disponible is liquid money only. Backup v6; v1–v5 import unchanged.
- Palette: ink-first neutrals, semantic coral/green/blue/amber, glyph tiles, ink tab bar.
- Checked locally: 355 domain/web + 119 mobile tests, TypeScript, Vite build, hygiene,
  Expo compatibility and Metro iOS export (recorded in the PR). No device evidence.

### 2026-09-20 — Interfaz 09: budgets, Home metric and assistant entry point

- Home has one large financial hero with a native-style Gastos / Disponible segment.
  Disponible is explicitly a recorded-account total, never bank sync or net worth.
- Monthly category budgets are durable local records with exact cents, month/currency
  identity, edit/archive, exceeded state and animated progress respecting Reduce Motion.
- Budget operations do not alter account balances; income and internal transfers do
  not consume spending limits. Backup schema v5 preserves active/archived budgets.
- Sparkles in the Home toolbar opens an honest Assistant preview. No provider request,
  financial-data upload, token/key, paid call or fake AI response is enabled.
- SQLite 4 → 5 migration is additive. CI uses Node 24-generation checkout/setup-node.
- Cards/debts remain the next accounting slice so card purchase and card payment are
  modeled once rather than double-counting consumption.

### 2026-09-20 — Interfaz 08: recurring commitments

- Weekly/monthly/yearly local recurring rules with amount, concept, category, account,
  next date, active state and stable calendar anchor.
- Due occurrences use deterministic IDs and are inserted in the same SQLite transaction
  that advances the schedule. App open/resume catches pending active dates safely.
- Dedicated Recurrentes screen supports create/edit/pause/reactivate plus separate
  30-day ARS/USD projections; Home shows only real upcoming expense commitments.
- Schema 4 and native backup v4 preserve the rules; v1/v2/v3 imports remain supported.
- No reminder permission, Apple Pay, Face ID, signed build, cloud cost or bank execution
  is enabled. Those stay behind the later signed-device/EAS gates.

### 2026-09-19 — Interfaz 07: spending-first direction

Product pivot and dashboard implemented; see status above and decision 002. Manual
local entry remains operational; cloud/Shortcuts base is explicitly disabled until
configured and tested. No remote SQL, API charges or signed build performed.


### 2026-09-14 — Interfaz 06: daily reports and fair comparisons

- Daily amounts open actual expenses. Comparison ranks category differences;
  links retain exact date cutoffs and currency. No extra Home card/tab.
- Equal elapsed days in current months; short February caps both periods with
  explanation. Full historical months disclose unequal lengths. Missing history
  never becomes invented savings. Integer cents and safe aggregate range guards.
- No database writes/schema changes, dependencies, paid services or production
  replacement. Native stack/press feedback and black-tab mitigation preserved.
- Checked locally: **317 domain/web + 85 mobile tests = 402**, TypeScript,
  iOS Metro JS/Hermes/assets export (1691 modules), root Vite build and repository
  hygiene. Online Expo compatibility hit an HTTP proxy timeout; local offline
  compatibility passed with Expo's reduced-reliability warning. Online CI must
  pass before merge. Real iPhone layout/gestures remain pending.
- Legacy import optional per owner; native backup/recovery retained.

### 2026-09-13 — Interfaz 05: account corrections and internal transfers

- Owner asks to continue bounded implementation and will review recent design
  together later. No new device acceptance, paid plan, EAS build or production
  replacement was authorized/started in this delivery.
- Account pencil edits name/current available balance. Explicit correction
  adjusts opening balance with a revision and local audit receipt, not a fake
  expense/income. Currency is immutable. Stale balance corrections reject if a
  posting changed the balance while the form was open. Name-only edits preserve it.
- Same-currency transfers use a single row representing both legs, integer cents,
  safe-range validation and one durable transaction. Edit/undo/recover plus audit
  receipts prevent duplicate effects or late retries reverting later changes.
- Contextual Transferir on account detail; native sheets, shared selectors/date/
  amount controls, both resulting balances and negative-balance warning. No added
  Home action or tab; neutral transfer row instead of fake spending/income color.
- Transfers appear once in mixed activity/recent results and on both accounts;
  reports remain expense/income-only. Undone transfers remain recoverable.
- New-account submission is also frozen across a failed post-commit refresh.
- SQLite 1/2 → 3 migration preserves filename, records, revisions and old receipts.
  Native v3 backup includes corrected accounts and transfer records/tombstones;
  imports v1/v2/v3, validates all data, blocks conflicts, adds atomically. No full
  local audit export, legacy import, actual bank execution or silent FX operation.
- Checked locally: **306 domain/web + 80 mobile tests = 386**, TypeScript,
  Metro iOS JS/Hermes/assets export (1688 modules), root Vite build and repository
  hygiene. Node SQLite tests include real v1/v2 migration interruption/restart,
  transfer/account audit failures, frozen retries, stale drafts and atomic import.
  Route-handler tests cover real handlers with native hosts replaced by descriptors;
  not UIKit rendering, animation frame pacing or gesture evidence.
- Local online Expo dependency check hit proxy timeout; no dependencies changed.
  CI online compatibility and both build/mobile jobs must pass before merge.
- Next: versioned legacy import plan/dry run with explicit supported entities;
  no wholesale re-entry of personal data. Combined iPhone review remains pending.
  [Walkthrough](empezar-en-iphone.md#10-interfaz-05-cuentas-y-transferencias).

### 2026-09-13 — Interfaz 04: contextual correction and native recovery

- Owner asks to continue while they review the design later. Their descriptions
  of categories/Home are not physical or visual acceptance. Keep the existing
  original palette, press/selection feedback, chart-value transitions and native
  stack/sheets. WhatsApp-like shared elements/MonAi scroll ideas are recorded as
  possibilities, not implemented via experimental navigation overlays.
- One reusable form now creates or edits native expenses/income. All fields
  prefill, identity/createdAt stay immutable, no-change saves do nothing, and a
  same-currency account correction recalculates both affected balances once.
  Exact submitted commands are held across retry/refresh failures; stale drafts
  cannot overwrite a newer version. Success/haptics follow durable storage/read.
- Deshacer is a tombstone, not a refund/extra income; Recuperar restores its
  original effect. Both require native confirmation with amount/account impact.
  Detail changes status in place, with no redirect; Settings lists recoverable
  undone entries. Active Home, activity and reports exclude tombstones.
- Local SQLite v1 → v2 migration keeps the same pilot filename and rows; adds
  version/state fields and an atomic local before/after edit audit. Tested restart,
  failed audit writes, interrupted ALTER/import batches, receipt retries and
  stale commands. A downgrade is refused intact; no remote schema is changed.
- V2 native snapshot export includes current revisions/tombstones, not full audit
  history. Native v1/v2 import previews counts and exact available totals by currency,
  skips equal IDs/data and blocks the entire batch on any conflict. It only adds
  missing rows; no reset/replacement/name-based account merging or implicit sync.
  Unsupported legacy/web/future/mixed formats, dangling/duplicate IDs, invalid
  cents/dates and unsafe totals are refused. Limit: 5 MB / 1,000 accounts / 25,000
  movements. No file is uploaded; source file is read-only; exports are not encrypted.
- Regression testing found an order-dependent extreme-balance failure: insertion
  validation could pass but a date-sorted reload overflowed an intermediate Number
  sum. Native balances now accumulate exactly with BigInt and check the final safe
  range, returning integer cents; no BigInt goes to SQLite/JSON or the legacy web.
- Checked: **282 domain/web + 61 mobile tests = 343**, mobile TypeScript, Metro iOS
  JavaScript/Hermes/assets export (1,681 modules), legacy Vite build and repository
  hygiene. Handler/host-descriptor tests include prefilling, cancel, busy/double-tap,
  retry, file review and native-confirmation wiring; they are not rendered iOS tests.
  The local online Expo compatibility request timed out at the environment proxy;
  its bundled offline check and the normal online CI check are recorded separately.
  Both CI jobs must pass before merging.
- No physical iPhone, native Files/sharing, canceled gesture, visual approval,
  signed build or frame-rate evidence for this iteration. No new dependencies,
  EAS build, charge, bank operation, personal-data publication or Supabase write.
  Next: owner checks Interfaz 04/03 and the existing black-tab stress test; then
  account corrections/transfers and versioned legacy import. Do not use the pilot
  as the principal ledger or re-enter the entire portfolio yet.

### 2026-09-13 — Interfaz 03: a focused dashboard and monthly spending report

- Owner asked to continue the original minimal iOS identity with a useful Home,
  categories and reports. This read-only slice does not replace the remaining
  edit/undo, backup restore or legacy import milestones.
- Home retains available cash/ARS-USD, expense/income and three recent movements.
  Account access is integrated into the balance surface instead of duplicating
  an account list. Tu mes adds the three largest categories with explicit partial
  coverage when more exist; all categories are available through Ver reporte.
- New native-stack report and category detail use the existing push/back owner.
  Month/currency remain in the report state and are passed to category detail;
  entry detail returns to its originating category. No redirects, focus reloads,
  fourth tab or new screen fade; the previous black-tab mitigation is preserved.
- Shared domain helper uses integer cents, complete historical calendar months,
  current month through today, and separate ARS/USD. Opening balances/income never
  become spending categories. Unsafe totals withhold the whole chart, not part of it.
  Case/accent/space variants group without rewriting records; exact normalized
  category equality is shared by the bars and their movement filter.
- One-color bars represent share of **total** spending, not share of the largest
  category. Amounts/percentages stay explicit; sub-0.1% values are not labeled zero.
  Transitions only occur when proportions change (260 ms; zero with Reduce Motion),
  without zero-to-total number animation or focus replay. List rows support large
  text, narrow widths, accessible names and virtualized long lists.
- Checked: **249 domain/web tests + 41 mobile tests = 290**, TypeScript,
  Metro iOS JavaScript/assets export and legacy Vite build. Mobile tests include
  report selections, actual route handlers/data scope, chart configuration and
  the existing SQLite/tab safeguards; these are not native rendering/gesture tests.
  Local Expo compatibility passed in offline mode only; online CI remains required
  before merging, together with clean installs, builds and repository hygiene.
- Browser component preview was attempted but returned ERR_BLOCKED_BY_CLIENT for
  the local preview. No alternate browser/network route was used. No screenshot,
  layout approval, physical gesture result, signed iOS build or frame-rate claim.
  Interfaz 03 in Settings identifies the delivery; the Spanish guide includes a
  non-mutating report walkthrough plus the still-open tab-switch stress test.
- No dependency, schema or storage change; no bank/merchant lookup, user-data
  publication, Supabase write, EAS build, paid service or legacy product change.
  Next: iPhone visual/back-navigation feedback, posted-entry edit/undo and recovery.

### 2026-09-12 — Interfaz 02: intermittent black tabs and visual feedback

- User reports completing the requested basic checks successfully, but a tab
  sometimes stays black (Settings/Movements, roughly one in ten switches).
  The visual design is explicitly not approved; the user asks for a more useful,
  distinctive, calm iOS experience and future merchant logos/category recognition.
- Inspected installed Expo Router 57's vendored BottomTabView, forFade and
  react-native-screens fallback. Fade animates scene opacity to/from zero and
  coordinates native inactive activity/detachment. This is a **plausible mechanism,
  not a reproduced physical-iPhone root cause**. No evidence of a lost SQLite record.
- Removed content fade for the three tabs; set detachInactiveScreens=false,
  lazy=false and freezeOnBlur=false. Native detail/modal stack is unchanged.
  No timed redirects, snapshots, focus reloads, forced remounts or global screen
  disabling. The tradeoff is keeping three lightweight roots mounted; lists stay
  virtualized. Source and configuration regression guards live under mobile UI/tests.
- Added a deep-blue available-balance surface, compact ARS/USD selection, category
  badges, searchable/reusable/custom category choice, and Tu mes. Existing strings
  are preserved; arbitrary category text has a safe symbol fallback (including
  object-prototype names). This is not AI classification or a seeded user dataset.
- Shared monthly summary uses recorded entry dates through today, integer cents
  and separate currencies; opening balances are excluded. Unsafe total magnitude
  returns an unavailable state instead of rounding or blanking the Home screen.
- Checked: 230 domain/web tests and 29 mobile tests (including two tab-layout
  configuration guards), TypeScript, Metro iOS JS/assets export and Vite build.
  These guards are not native navigation/performance tests. CI must pass online
  Expo compatibility, clean installs, builds and hygiene before merge.
- Interfaz 02 is visible in Settings. Spanish guide and device checklist specify
  cache-only restart, 30–40 tab switches, search retention, keyboard/background
  cases and non-mutating category draft tests. No local data reset or reinstall.
- No visual preview or native runtime reproduced the intermittent issue here.
  Physical iPhone re-test and visual feedback remain open. Next: resolve any
  remaining native issue, then posted-entry edit/undo and safe restore/import.
- Merchant logos are future verified assets with category/initial fallback;
  do not generate fake marks or send private entry text to lookup providers.
  Reports/charts remain planned around real periods/categories, not decoration.
- No new dependency, DB/schema mutation, cloud write, EAS build, charge or legacy
  production behavior change. Official reference for the affected tab options:
  [React Navigation bottom tabs](https://reactnavigation.org/docs/bottom-tab-navigator/).

### 2026-09-12 — First native visual-system iteration

- Added original system typography, quiet grouped surfaces, semantic colors and
  compact rows. No real user data or seeded sample balances enter the app/repo.
- Home distinguishes available cash by currency from future full net worth.
  Expense/income preselection follows the selected currency or explicit account.
- Activity searches concept/category/account without accent/case sensitivity,
  filters type and uses stable, virtualized date groups. Account detail reuses it.
  Today/yesterday labels refresh at midnight and when returning to the app.
- Account selection no longer renders one button per account inside the form.
  Date selection keeps a separate draft until Listo; Cancelar/swipe discards it.
  iOS amount input includes a keyboard-dismiss action; large-text row layout adapts.
- One accessibility subscription controls restrained press/selection motion;
  stack/sheet transitions remain native. No screenshot overlays or back redirects.
- Checked on Linux: mobile TypeScript, 20 storage/toolchain/presentation tests,
  Metro iOS JavaScript/assets export, 221 domain/web tests and Vite build.
  Expo compatibility checked locally in offline mode; the regular online check
  and clean-install/build jobs remain required in the PR before merging.
- Browser component preview could not be opened by this environment's browser.
  No screenshot/layout approval, UIKit/date-keyboard behavior, canceled gesture
  result, signed build or frame-rate evidence is inferred from compilation.
  The first pilot's approval does not approve this new UI; device checklist pending.
- Recorded the reported iPhone 14 Pro/iOS 26.6.1. Updated the Spanish guide to
  switch old pilot checkouts to `master`, retain SQLite, and explain Expo Go vs
  EAS Build vs an independent preview. Stay free for this step; no build or charge.
- No schema, dependencies, signing configuration, Supabase data or legacy
  production code changed. Next: device feedback, posted-entry edit/undo,
  versioned restore/import preview, then the next migration milestones.

### 2026-09-12 — Expo Go pilot accepted; next milestone defined

- User reports following the guide successfully on their iPhone, registering an
  expense/movement and finding it unchanged after closing and reopening Expo Go.
- User describes the navigation/animations as fluid and native; accepts continuing
  with the chosen architecture and asks for an original minimal iOS visual design.
- Device model, iOS version and tested revision were not provided. No independent
  build, canceled-gesture matrix, accessibility matrix or performance measurement
  is inferred from this report. See the updated device checklist.
- Next scope: design system and first three screens, edit/undo and safe import.
  Cards, investments, reports/assistant, Apple integrations and sync follow their
  existing phases. No Expo/Apple subscription, cloud build or database change was
  initiated. The owner already has a working Expo Go development setup.

### 2026-09-11 — Foundation started

- GitHub access confirmed for existing public `facur3/finanzapp-v2`.
- Remote base: `e299eb3` (same tree as existing local fixes). The user's unrelated
  legacy iOS splash asset change is untouched in its original worktree.
- New work is isolated on `feat/expo-native-foundation`; no cloud build/submission.
- Existing baseline: 192 tests passed. Mobile verification pending implementation.
- User action next: create/sign in to Expo, install Expo Go, then link the project.
  Apple membership is needed for the signed iPhone development/TestFlight build,
  not to begin writing or testing the pure logic.

### 2026-09-11 — First slice implemented and checked on Linux

- Independent Expo SDK 57 / React Native 0.86.3 install and lockfile, with
  isolated development/preview identities. No production/cloud credentials.
- Empty home, ARS/USD accounts, opening balances, editable expense/income drafts,
  activity/detail, system date picker and explicit JSON export.
- Native stack/sheets, tab fade, press feedback, save haptic, light/dark background
  consistency and reduced-motion support implemented. No iPhone result claimed.
- Integer cents and safe-range validation; opening balance is not income.
- Parameterized SQLite, atomic migrations, dedicated transaction connections
  configured before BEGIN, repeated-ID protection and recoverable initialization.
- **Checked:** 221 domain/web regression tests (including 29 new ledger cases),
  10 integration tests using real temporary SQLite files, mobile TypeScript check,
  Metro iOS JS/assets export and existing Vite production build.
- Local Expo dependency check passed in **offline mode only** after the online
  command's network approval was canceled. Added a normal online compatibility
  check and mobile install/typecheck/storage/export job to GitHub Actions.
- Added a nested repository hygiene guard for mobile dependencies, build outputs,
  local databases, environment files and signing files.
- **Not yet checked:** signed Xcode compilation, native SQLite driver on-device,
  gesture smoothness, system sharing, keyboard/date layout and accessibility on iPhone.
- **Not migrated:** current personal data, cards, holdings, reports, assistant or
  Supabase. No new user data was seeded and no paid/cloud service was started.
- Next: follow [the Spanish iPhone guide](empezar-en-iphone.md), record the device
  gate, then implement previewed legacy import and reversible ledger edits.

### 2026-09-12 — Follow-up dependency fixes checked

- Aligned TypeScript to Expo SDK 57's expected `~6.0.3` and explicitly included
  Node/React types. The previous published CI failure was the older TS version.
- Replaced the two vulnerable indirect packages with patched upstream versions.
  The decoder needs a small CommonJS adapter to preserve the router caller's API;
  the scoped UUID override preserves the Xcode generator's CommonJS API. Details
  and removal criteria are in `apps/mobile/compat/README.md`.
- Clean `npm ci` succeeded; the installed dependency tree is valid and the mobile
  `npm audit` snapshot reports zero vulnerabilities. This is not a full security audit.
- Passed: TypeScript, 13 SQLite/toolchain tests, Metro iOS JS/assets export,
  221 domain/web tests, Vite production build and repository hygiene.
- Expo compatibility passed locally in offline mode. The online endpoint timed
  out through the workspace proxy; the normal online check remains enabled in
  GitHub Actions and must pass there before merging the foundation PR.
- No UI or database schema changed in this follow-up. The design brief is a plan
  for the next iteration; the user's Expo Go result predates these dependency fixes.
