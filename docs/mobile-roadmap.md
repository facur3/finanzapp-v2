# FinanzApp mobile: living roadmap

Updated: 2026-09-24. Read [decision 001](decisions/001-native-mobile.md),
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

## Status and current delivery — Producto 23.1C2

Implemented is code, checked names a test, device-verified needs a physical result,
and released means distributed. Neither a bundle nor a screenshot is App Store QA.

**23.1C2 publishes the first official internationalization: Spanish and English,
combined independently with Argentina and the United States.** English and the US region
are released in code (`RELEASED_LANGUAGES = ['es', 'en']`, `RELEASED_REGIONS = ['AR', 'US']`)
and declared to iOS; reaching the iPhone needs the new EAS development build below. No
SQLite, schema, stored amount, accounting rule, backup format or currency change; ARS and
USD remain the only currencies (more is Producto 24). No redesign. Process, precedence and
iOS limits: [docs/i18n.md](i18n.md) §10 and §11.

- [x] **Released in Más.** Idioma (Según el dispositivo, Español, English) and Región
  (Según el dispositivo, Argentina, Estados Unidos, each with a sample) for everyone,
  independent, persistent (two key-value keys outside the ledger and backups) and live.
  The "Spanish only for now" note is gone; the store still refuses a value outside the
  gate (tested with an explicit narrower gate). Choices saved in the 23.1C1 preview now
  apply (expected).
- [x] **iOS declares the released languages** (`app.config.ts`): the `expo-localization`
  plugin with `supportedLocales: { ios: ['es', 'en'] }` writes `CFBundleLocalizations`
  (kept equal to `RELEASED_LANGUAGES` by a test that also runs the real plugin; iOS-only
  form, so no Android Gradle or locale files change), `CFBundleDevelopmentRegion` 'es'
  (iOS's own text falls back to Spanish like the app) and
  `UIPrefersShowingLanguageSettings` (the per-app language row always shows). iOS's edit
  menu, share sheet and UIKit buttons now follow the app's language; the ⓘ alerts carry
  the app's own "OK" (still the cancel action, so Esc and VoiceOver's escape gesture close
  them). FinanzApp Preview is not built or touched.
- [x] **Automatic preferences.** "Según el dispositivo" re-reads the device on return to
  the foreground **and** on iOS's own locale-change event (`onLocaleSettingsChanged`, through
  the probed module, so an older binary still never evaluates the package); both are
  idempotent and a failed read keeps the last good one. iOS quits the app on an iPhone or
  per-app language change (Apple), so the next launch reads the new language; a Region
  change keeps it running and re-renders in place.
- [x] **Nothing lost on a change.** No remount of navigation, forms, an open date sheet or
  the Assistant (a request in flight is neither aborted nor re-sent); a half-typed amount
  changes separators only; stored amounts never change (the real provider on a real
  reconciler; the Assistant harness runs effects by their dependencies).
- [x] **VoiceOver in the four combinations.** Spoken numbers use the language's decimal
  mark **without grouping** ("1234,56 pesos", "1234.56 dollars"): a group separator is the
  one mark a Spanish voice of another variety or Region could misread by a factor of a
  thousand. Generic rows, fields, the account sheet, shortcuts and the Save button speak
  their amounts through spoken twins; `accessibilityLanguage` is set only when the interface
  language differs from the device's (the owner's es/es setup keeps its voice); Idioma speaks
  each autonym in its own language; Assistant replies (Spanish in v1) keep a Spanish voice.
  A TypeScript-checker test guards every accessibility attribute. Limits documented in
  docs/i18n.md §10 (system chrome, VoiceOver's own words, announcements, text read as shown).
- [x] **Date wheel.** Takes the language with its home region (`es_AR`, `en_US`) in all
  four combinations, so months and column order follow the language and match the row;
  Apple's own `en_AR` (day-first) and `es_US` (changed in April 2026) data would contradict
  the app. `onValueChange`/`onDismiss` replace the deprecated `onChange`; the row is read as
  the long date.
- [x] **Copy in both languages.** A bilingual review with a second skeptical reviewer
  per area: Spanish errors fixed (a collection's direction, "cuatro" named donut slices, a
  wrong preposition, "Ícono", region-neutral placeholders instead of Carrefour/Galicia/
  Cocos), English glossary and naturalness fixes (~70 keys: transaction, record, recurring
  item, Transportation/Entertainment, errors), two domain budget errors that were shown in
  Spanish now translated, the largest-expense day in the region's order ("9/22" in the
  US), "Vence hoy"/"Due today" in lower case inside sentences, the currency code inside
  obligation balances ("Owed ARS 50.00"), a card paid to zero reads "Sin deuda" (not "A
  favor ARS 0,00") in the transfer form, and signed balances in the account sheet.
- [x] **Assistant.** The interface follows the language; failures show only catalogue
  notes (never a caught Spanish or engine sentence); income chips resolve as income;
  evidence rows keep the currency the answer was computed in (a later change of the
  screen's currency no longer relabels them) and say a difference that grew ("… más"). The
  request still carries no language: the v2 design (locale as two codes, language-neutral
  facts, server before app, category identity matching before connecting English) is in
  docs/i18n.md §11. No paid AI.
- [x] **Production builds do not depend on `EXPO_PUBLIC_LOCALE_PREVIEW`:** the flag now
  changes nothing (`PREVIEW` equals `RELEASED`) and `tests/locale-release.node.ts` compiles
  `provider.tsx` with babel-preset-expo for production with and without it (`__DEV__`
  inlined as false), mounts the result and scans configs; the local iOS export contains
  the flag's name 0 times.
- [x] **Checked on Linux:** 454 mobile tests (389 before; new files `locale-release`,
  `voiceover`, `date-field`), TypeScript, `i18n:extract` 0, `i18n:check --strict` 0 errors /
  0 stale (English accepted after review), `expo install --check`, `npm ls --all`, Metro iOS
  export, `expo config --type introspect` for both variants (development
  `com.facur3.finanzapp.dev` and preview `com.facur3.finanzapp.preview` unchanged, both
  `CFBundleLocalizations [es, en]`), root tests (398), Vite build, repo hygiene.
- [ ] **Not device-verified:** everything above on the iPhone (checklist 23.1C2), in
  particular the iOS Settings language list, system text after the build, Region while
  running, relaunch on language changes, VoiceOver voices and number reading, and the
  date wheel.
- [ ] **Blocked on the owner:** the EAS development build (`eas build --profile development
  --platform ios`) and its installation over FinanzApp Dev; no build, submission or paid
  service was started.

### Previous delivery — Producto 23.1C1

**23.1C1 prepares the regional formats and the internationalized amount experience
without publishing them.** Producto 23.1C is split in two: **23.1C1** (this PR) makes
every amount, number, percentage and date correct for Spanish and English combined
independently with Argentina and the United States, behind the unchanged release gate;
**23.1C2** publishes English and the US region with `supportedLocales` and a new EAS
build. The language gives the words, the region the separators, numeric dates and the
clock, the account the currency. No SQLite, schema, stored amount, accounting rule,
backup format, currency engine, native module, dependency or app-config change; ARS and
USD remain the only currencies. Process, tables and iOS limits:
[docs/i18n.md](i18n.md) §9.

- [x] **Amount field in the region's separators** (`money-input.ts`, `AmountInput`,
  `AmountField`). Argentina 1.234,56, United States 1,234.56; the 23.0 design kept
  (anchored symbol, tabular figures, fixed origin, no movement at 999 → 1.000 /
  999,999 → 1,000,000). Either key of the iOS decimal pad is the decimal separator (the
  pad shows the device Region's and cannot be changed by an app). Each change is read
  against the last render and the raw text the native view may still hold, so fast
  typing reads as keystrokes; this also fixes a period typed from a US pad being lost
  when the native view lagged (Argentina). The form's draft stays in the ledger notation
  that `parseMinorUnits` reads, so a region change with a form open keeps the value, the
  draft and the logical caret. No floating point.
- [x] **Pastes that never guess.** "1.234,56" and "1,234.56" work in every region; a
  repeated separator groups; one separator before one or two digits is decimal;
  currency marks and spaces are ignored. Refused with a note under the field (announced
  to VoiceOver) and the field unchanged: one separator before exactly three digits that
  is not the region's group separator ("1,000" in Argentina, "1.000" in the US), extra
  non-zero decimals, text that is not a number, a second decimal or sign, a fourteenth
  whole digit.
- [x] **One road for money.** Every visible amount goes through `moneyText` /
  `formatAmount` / `codedAmount` (region; "AR$" for pesos in the US, a no-break space after
  the symbol); every VoiceOver amount through `spokenMoney` / `spokenAmount` /
  `spokenNumber` / `spokenPercent` (the interface language's own separators, so an
  English voice never reads "1.234,56"); prefills through `draftFromMinor`. Replaced
  ~40 direct `formatMinorUnits` calls and hand-written "$ "/"US$ " signs in Inicio,
  Movimientos, Reportes, Presupuestos, Tarjetas, Deudas, Recurrentes, Cuentas, details,
  forms, the currency picker and the Asistente's Editar; a test forbids them in `app/` and
  `src/ui/`. Backup review counts use the region's grouping.
- [x] **Spanish-Argentina differences (deliberate):** the date wheel's month names follow
  the app language (`DateField` passes `es_AR`), budget VoiceOver sentences say
  "pesos"/"dólares" instead of "$" (read as dollars by a Spanish voice), backup counts
  above 999 are grouped, and symbol and number are joined by a no-break space. Everything
  else reads byte for byte as before (tested).
- [x] **Development preview:** a FinanzApp Dev bundle started with
  `EXPO_PUBLIC_LOCALE_PREVIEW=1` lists English and Región in Más so the four
  combinations can be checked on the iPhone now; release bundles ignore the flag and a
  choice saved in the preview is not applied without it (same pattern as
  `EXPO_PUBLIC_ASSISTANT_FIXTURES`).
- [x] **Accounting safety:** amounts typed in either region are stored as the same integer
  (real SQLite test); formatting in four locales leaves the ledger, the schema version
  and every row identical; a transfer between ARS and USD is still refused by the domain
  and never records an expense.
- [x] **Checked on Linux:** 388 mobile tests (16 new, others rewritten: the amount controller
  in both regions and both decimal keys, lagging native text, pastes accepted and refused,
  region switches with the caret, drafts; formatters in the four combinations; Money and
  the anchored field with "AR$" at every text size; the real `AmountField` mounted under
  the real provider switching region and language with a half-typed amount; SQLite
  persistence; the central-formatting guard and the preview gate), TypeScript,
  `i18n:extract` 0, `i18n:check --strict` 0 errors / 0 stale, `expo install --check`,
  Metro iOS export, root tests, Vite build, repo hygiene (results in the PR).
- [ ] **Not device-verified:** everything above on the iPhone (checklist 23.1C1), in
  particular VoiceOver with a Spanish voice in the US region and the date wheel's column
  order for en-AR/es-US (iOS decides; record what it shows).
- [x] *(Delivered in 23.1C2.)* **Pending for 23.1C2:** release English and the US region (`RELEASED_LANGUAGES`,
  `RELEASED_REGIONS`), the Región row for everyone, `expo-localization`
  `supportedLocales` (native rebuild through EAS, with the owner's authorization), device
  QA of the four combinations at the largest Dynamic Type, the VoiceOver decision for
  es-US from the device check, and whether the Assistant request carries the interface
  language.

### Previous delivery — Producto 23.1B2

**23.1B2 completes the extraction and translation of the whole app.** Reportes,
Tarjetas, Deudas y cobros, Cuentas, Presupuestos, Recurrentes, Categorías, copias de
seguridad, Más/preferencias and the Asistente read every visible string, alert,
confirmation, empty state, dynamic title, descriptive date, chart label and VoiceOver
string from the catalogues. The English catalogue is complete (≈1 090 keys) and still
unreleased (`RELEASED_LANGUAGES = ['es']`). Spanish is unchanged except three singular
fixes ("1 gasto registrado" in the day report and in a timeline bar's VoiceOver, "Hay 1
registro" in a backup conflict) and one consistency fix: a built-in category the person
renamed now shows its new name in Reportes (budget rows, insights) and in the Asistente's
evidence rows and chips, as it already did in Presupuestos and Movimientos.
No SQLite, schema, stored amount, accounting rule, backup format, currency engine,
amount-field separator, native module or dependency change. Process and architecture:
[docs/i18n.md](i18n.md).

- [x] **Modular catalogues.** `messages/es/*.ts` and `messages/en/*.ts`, one module per
  area (common, navigation, home, activity, forms, categories, preferences, errors,
  reports, cards, debts, accounts, budgets, recurring, category-manager, backup,
  settings, assistant), composed in each `index.ts`; `messages.ts` remains the single
  typed entry. English modules are typed `Pick<Messages, …>`, so a missing key fails to
  compile in the module that owns it.
- [x] **CLDR plurals.** Plural entries accept zero/one/two/few/many/other and are chosen
  with `Intl.PluralRules`, falling back to one/other; plural detection is strict (a
  namespace holding an id called "other" is not a plural).
- [x] **Transfer form parameters.** Tarjetas and Deudas no longer send a Spanish `title`
  or `note` in the URL: the form derives its title (card payment, debt payment,
  collection) and writes its default note with `t(…)` (a caller's note still wins, so
  Spanish notes such as "Pago Visa" are unchanged). A debt's hidden account ("Debo ·
  Juan") keeps its stored name; only its Spanish prefix is read in the interface
  language ("I owe · Juan", `accountDisplayName`, `useAccountNameOf`) in rows, the
  transfer detail and the payment form, so Spanish is byte-identical even after the
  counterparty is edited.
- [x] **Categories.** Built-in names localized everywhere (lists, reports, budgets,
  insights, the Asistente's chips); editing a built-in category in English without
  renaming saves the identity's own label, never the English word; custom and renamed
  names keep the person's text.
- [x] **Asistente.** Interface copy (suggestions, notes, clarifications, draft card,
  evidence rows and links, fixture banner) translated and stored as keys so it follows a
  language change; model output and the development fixtures are content and stay as
  written; the protocol fact labels sent to the server are unchanged and evidence is
  shown from fact ids.
- [x] **Errors.** Every message the domain and the storage layer throw is catalogued
  (164 keys), including templates («{name}»), and shown in the reader's language by
  `ErrorMessage`/`errorText`; forms and screens store their own errors as keys. Risks of
  the text coupling and the migration to stable error codes: `docs/i18n.md` §5.
- [x] **Tools for many languages** (local, no service): `npm run i18n:extract` (copy
  outside the catalogue, with a justified allow-list), `npm run i18n:check` (missing
  keys, placeholders, plural categories per language, empty text, stale translations via
  `i18n/translations.lock.json`), `npm run i18n:export -- <lang>` (a brief per key with
  source, English, context comment, placeholders, plural categories and glossary terms,
  for AI-assisted translation or a platform), pseudo-locales (long and RTL) and
  `i18n/glossary.json`. All run in the test suite. A library evaluation (FormatJS ICU,
  i18next, Lingui), the Crowdin plan and the RTL checklist are in `docs/i18n.md`.
- [x] **Decoupling reviewed.** The domain, SQLite and `money-input.ts` import nothing
  from i18n; no component interpolates or picks plurals itself; only `useI18n()`.
- [x] **Checked on Linux:** 372 mobile tests (29 new: English cases in every area's
  harness — Reportes, Tarjetas, Deudas, Cuentas, Presupuestos, Recurrentes, Categorías
  with the preset-identity case, backup review/restore identical to Spanish, Más,
  material labels, Asistente with an unchanged model message and an identical confirmed
  draft — plus plural categories, the validator, the export brief, pseudo-locales,
  template errors and debt display names), TypeScript, `i18n:extract` 0, `i18n:check
  --strict` 0 errors / 0 stale, `expo install --check`, dependency tree, `npm audit`,
  Metro iOS export, root tests, Vite build, repo hygiene (results in the PR).
- [ ] **Not device-verified:** that nothing visible changed in Spanish on the iPhone;
  English is seen only in tests until 23.1C.
- [ ] **Pending for 23.1C (then):** release English and the US region together; regional
  separators in the amount field (`money-input.ts`), `Money`, row amounts and VoiceOver
  amounts; the Región row in Más; date pickers' locale; `expo-localization`
  `supportedLocales` (native rebuild); device QA of English at the largest Dynamic Type;
  decide whether the Assistant request carries the interface language. *(Formats, the
  amount field and date pickers: delivered in 23.1C1; the rest is 23.1C2.)*

### Previous delivery — Producto 23.1B1

Producto 23.1B (every screen's copy in the catalogue) is split into two PRs. **23.1B1**
(delivered): navigation, Inicio, Movimientos, the main movement forms and the shared
components. **23.1B2** (next, after this PR is approved): the remaining financial
screens, Reportes, Tarjetas, Deudas, Recurrentes, Presupuestos, Cuentas, Categorías,
backup and the Asistente. English stays unreleased and unlisted until 23.1B2 and 23.1C
are complete. No visible Spanish text changed; no schema, SQLite, stored amount,
accounting rule, backup, currency engine, `AmountField` separator or `money-input.ts`
change; no native module.

- [x] **Catalogues** (`messages/es.ts`, `messages/en.ts`): new namespaces `nav` (five tab
  labels, both header actions and every stack header title, B2 screens included, since
  headers are navigation), `boot`, `home`, `budgetStatus`, `quickActions`, `activity`,
  `movement`, `accountKinds`, `rows`, `entryForm`, `transferForm`, `entryDetail`,
  `transferDetail`, `spendingDetail`, `categories` and `errors`. Every Spanish value is
  the string the screen showed before, byte for byte (the 323 existing route tests,
  which assert Spanish copy, pass unchanged apart from three contract updates below).
  Plurals (`{ one, other }`) for movement, expense, account, category, day and budget
  counts. The English catalogue is complete for the same keys.
- [x] **Screens moved to the catalogue:** root layout (loading and failure screens,
  every header), tab layout (labels, "Ver mis cuentas", "Registrar movimiento"), Inicio
  (metric switch, hero, contextual help, section titles, empty states, budget card,
  upcoming row, category ranking VoiceOver), quick actions, Movimientos (search,
  filters, count, empty states, day headers and their VoiceOver net), movement detail
  (title, status, rows, budget line, undo/restore alert, buttons), transfer detail,
  spending period detail, Movimientos deshechos, the movement modal (Gasto / Ingreso /
  Transferencia), the entry form and the transfer form (card payments and debt
  settlements included, since they share it), edit-not-possible states, and the shared
  components (`EntryRow`, `TransferRow`, `AccountRow`, `ErrorMessage`, `AccountField`,
  `CategoryField`, `DateField`, `CurrencyField`, `AmountField`). Row dates go through the
  new `relativeDate` (Spanish identical to the domain's `labelFromISO` for every day
  tested); header titles are set from `useI18n()`, so they re-title in place.
- [x] **Built-in categories** read in the interface language (`categories.<kind>.<key>`,
  keyed by the identity key, e.g. `categories.expense.comida` → "Food"). Only the
  display label changes (`localizedCategoryLabel` in `src/ui/appearance.ts`, applied by
  `useCategoryLook`/`useCategoryLookOf`): the stored string ("Comida"), the identity key,
  budgets, history, reports grouping and backups are untouched. A renamed preset, a
  custom category and a historical string are the person's own words and are never
  translated. The picker lists translated names, finds either name ("food" and "comida")
  and never offers to create "Food" as a duplicate; Movimientos search also matches the
  displayed name.
- [x] **Errors in the reader's language, at display time.** `ErrorMessage` translates
  through `errorText` (`src/i18n/errors.ts`): a form stores its own message as a catalogue
  key (`entryForm.futureDate`), and a thrown domain/storage message is recognised by its
  exact Spanish text (`errors.domain.*`, `errors.storage.*`). An error already on screen
  therefore follows a language change; an unrecognised message (from a B2 area) is shown
  as thrown, never blank. A test fails if any catalogued message stops being thrown
  verbatim.
- [x] **Card/debt glyph no longer depends on wording.** `AccountField` decided "card or
  debt" by checking whether the kind label started with "Tarjeta"; it now takes `typeOf`
  (the ledger's `accountKind`), so "Credit card" still shows the card glyph.
- [x] **Overflow review for English.** Segment, tab and quick-action labels stay at or
  under the Spanish length (Activity filters: All / Expenses / Income / Transfers;
  movement modal: Expense / Income / Transfer); buttons ≤ 24 characters and header
  titles ≤ 24 on a 320 pt iPhone; a length-budget test guards both catalogues. No
  layout, spacing, material or motion changed; Dynamic Type, VoiceOver labels, both
  themes, Reduce Transparency and Reduce Motion paths are the same components as before.
- [x] **Checked on Linux:** 343 mobile tests (20 new: `translation.node.ts` with 14 cases
  — release gate, no hard-coded copy left in the 20 B1 files, every key the code asks
  for exists and parameterless calls have no placeholders, both catalogues complete and
  really English, plurals for 0/1/2/21/1000, placeholder filling, error localisation,
  catalogued errors still thrown verbatim, built-in category identities unchanged,
  picker search and no duplicates, Movimientos search, row dates byte-identical to
  `labelFromISO`, account kinds, length budgets; four in `recovery-routes.node.ts` — the
  entry form in English saves a movement identical to the Spanish one, a language switch
  mid-draft keeps every field, errors stored as keys or thrown text and shown in either
  language, movement detail and transfer form in English; one in `navigation.node.ts` —
  tab labels and header actions; one in `spending-home.node.ts` — Inicio in English with
  the same figures and an in-place switch back), TypeScript, `expo install --check`,
  dependency tree, `npm audit` (0), Metro iOS export (Hermes), 397 root tests, Vite build,
  repo hygiene. Mutation checks: a reintroduced literal label and a misspelled key each
  fail the scan tests.
- [ ] **Not device-verified:** that nothing visible changed in Spanish on the iPhone
  (every screen of the list above, both themes, largest Dynamic Type, VoiceOver). English
  cannot be seen on the device until it is released (23.1C); its layout is checked by
  the length budgets, not by UIKit.
- [ ] **Known gaps left for 23.1B2:** the screens listed above as B2; the `title` and
  `note` route parameters those screens pass to the transfer form (a card or debt payment
  opened from Tarjetas/Deudas still carries a Spanish title); domain/storage errors of
  cards, debts, budgets, recurring rules, categories and backups; `SpendingTimeline`
  (unused) copy; accessibility amounts still use `formatMinorUnits` with the currency
  code (regional separators are 23.1C).

### Previous delivery — Producto 23.1A

Producto 23.1 (complete internationalization) is split into three independent PRs:
**23.1A** reactive language and region architecture, **23.1B** every
screen's copy in the catalogue, **23.1C** regional money formats and the amount field,
the English release and the native language configuration. 23.1A changes no visible
text beyond the new Idioma row and screen, no financial semantics, schema, backup,
migration, AmountField or `money-input.ts`, and adds no native module.

- [x] **Problem.** `AppLocale` ('es-AR' | 'en-US') tied the language to the region, so
  English with Argentine formats or Spanish with US formats could not be expressed;
  one stored preference held the whole tag; the provider resolved once at launch, so a
  choice could only take effect after a restart.
- [x] **Model** (`src/i18n/locale.ts`). Two registries: `LANGUAGES` (es, en; each with
  its own name) and `REGIONS` (AR, US; decimal and thousands separators, numeric date
  order, 12/24 h clock, and which currency a bare "$" names). `AppLocale` is only the
  composition `${language}-${region}`, so `es-AR`, `es-US`, `en-AR` and `en-US` all
  exist and a new language or region is one registry entry (plus a catalogue).
  `resolveLanguage` (explicit released choice → first released device language →
  Spanish) and `resolveRegion` (explicit released choice → the device's Region setting,
  the first locale's `regionCode` or, from Intl, its tag → Argentina) are independent;
  the region is never taken from a second preferred language, and the Arabic tag "ar"
  is never read as Argentina. Separate release gates: `RELEASED_LANGUAGES = ['es']`,
  `RELEASED_REGIONS = ['AR']`. Interface language, region, an account's currency, a
  future main report currency and the stored integer amount stay five separate things.
- [x] **Unsupported device values.** A device in Portuguese, French or any language
  without a catalogue reads Spanish (the next supported preferred language first, once
  released); a region without conventions (Uruguay, Spain, Brazil) reads Argentina.
  "Según el dispositivo" says what the device gives right now ("Ahora: Español").
- [x] **Formats** (`src/i18n/format.ts`). Words follow the language (month and weekday
  names, relative days, long-date phrasing, spoken amounts, currency names, the space
  before "%"); conventions follow the region (separators of amounts, counts and
  percentages, `formatNumericDate` and `formatDateTime` day/month order, 24 h or
  AM/PM, "$" vs "AR$"). With Argentina every output is byte-identical to Producto 23.0
  and `formatAmount` is still the domain's `formatMinorUnits` string. Nothing
  persisted changes.
- [x] **Catalogues** are per language (`messages/es.ts`, `messages/en.ts`; `translate`
  and `translator` take a language), with the new `preferences.*` keys: Idioma,
  Región, Según el dispositivo, the notes, the save-failure message and the region
  names. The rest of the screen copy is 23.1B.
- [x] **Preferences** (`src/i18n/preference.ts`): two keys in expo-sqlite's key-value
  store, `finanzapp.language` and `finanzapp.region`, outside the ledger and outside
  backups; "follow the device" is the absence of the key; values are validated on read
  (the 23.0 tag shape "es-AR" still reads as Spanish); an unreadable store follows the
  device and never deletes or resets anything; a failed write reports false.
- [x] **Live store and provider** (`src/i18n/store.ts`, `src/i18n/provider.tsx`). The
  store saves first and applies second (a rejected write changes nothing), refuses a
  value outside the release gate whoever asks, and replaces its state only when
  something visible changed. `I18nProvider` holds one store for the app's lifetime and
  subscribes with `useSyncExternalStore`; the translator/formatter context is rebuilt
  only when the resolved locale changes, so only `useI18n()` consumers re-render. The
  provider never keys or remounts its children: the ledger provider (SQLite), the
  navigation stack, the current screen, a half-typed form and the Assistant
  conversation keep their state. "Según el dispositivo" is re-read when the app returns
  to the foreground (`AppState`), so a Region change in iOS Settings is followed without
  a restart. `useLocalePreferences()` gives the chooser the state and the setters.
- [x] **Interface.** Más → App y datos gains **Idioma** (`NavigationRow`, neutral
  `language-outline` glyph, subtitle "Español · según el dispositivo" or "Español"). It
  pushes `app/language.tsx`: one grouped list of `CheckRow`s (the NavigationRow shape
  with a checkmark instead of a chevron; VoiceOver reads title, subtitle and
  "selected"), "Según el dispositivo" first, then the released languages; a selection
  haptic; the header title comes from the catalogue; a failed save keeps the checkmark
  and shows an error; a footnote says Spanish is the only language for now and that
  neither preference touches movements, accounts or backups. **English is not listed**,
  not even greyed out.
- [x] **Decision: Región is prepared, not activated.** `app/region.tsx` (Según el
  dispositivo, Argentina, and from 23.1C United States, each with a sample
  "22/9/2026 · 1.234,56") is built and tested but Más shows its row only when more than
  one region is released (`showsPreference`). Reason: the amount field
  (`money-input.ts`) still types and parses Argentine separators, so a US region would
  write amounts one way and let the person type them another. 23.1C releases the US
  region together with the amount field's separators.
- [x] **Checked on Linux:** 323 mobile tests (in `i18n.node.ts` eight new cases replace
  the two 23.0 locale cases: the four combinations, tag parsing, language and region resolution,
  unsupported devices, both keys with failing reads/writes, words vs conventions;
  `locale-switch.node.ts` with the live store and the real provider and Idioma screen
  on `react-test-renderer` (14 cases), switching language and region while a form draft and an
  Assistant conversation stay mounted, the ledger provider never re-rendered, the
  AppState refresh and its cleanup, the release gate; one `more-routes.node.ts` case:
  Más shows Idioma and hides Región), TypeScript, `expo install --check`, dependency tree, `npm audit` (0),
  Metro iOS export (Hermes), 397 root tests, Vite build, repo hygiene. A mutation that
  keys the context on the locale fails three of the switch tests.
- [x] **Dependency:** `react-test-renderer@19.2.3` as a dev dependency only (matches
  React 19.2.3; not in the app bundle). No runtime or native dependency changed; the
  installed FinanzApp Dev runs this PR from Metro without a rebuild.
- [ ] **Not device-verified:** the Idioma row and screen at the largest Dynamic Type,
  with VoiceOver, both themes and Reduce Transparency; the preference surviving a force
  quit; no visible change anywhere else. The in-place switch to another language cannot
  be seen on the iPhone until English is released (23.1C); it is proven by the tests.
- [ ] **Pending in Producto 23.1:** **23.1B** every screen, header, tab label, sheet,
  alert, empty state, VoiceOver string and the Assistant copy through the catalogue
  (Navigation headers read `useI18n()`), with the English catalogue complete and still
  gated; **23.1C** the US region released together with locale-aware `Money` and the
  amount field's separators, English released (`RELEASED_LANGUAGES`), the Región row in
  Más, date pickers' locale and `expo-localization`'s `supportedLocales` config plugin
  (a native rebuild).

### Previous delivery — Producto 23.0

Producto 23.0 — Interaction Polish & Localization Foundation fixes the two reported
form defects at their root, audits the shared rows for text that could clip or split,
and lays the localization infrastructure (es-AR and en-US) without exposing English
yet. No financial semantics, schema, backup, migration or cloud change.

- [x] **Problems found.** The currency row concatenated "Dólares estadounidenses · USD"
  into one right-aligned value, so the code wrapped alone under the name; the amount
  field centred its digits and placed the symbol from an estimated text width, so the
  symbol and the number both moved at every digit and grouping dot ("999" → "1.000",
  "999.999" → "1.000.000"); two- and three-column statistics, segmented labels, names
  beside amounts and "label · CODE" strings could clip or split at large text.
- [x] **SelectionRow** (`src/ui/components.tsx`): label as a caption, the chosen value
  as the primary line (up to three lines), an optional detail line, a glyph or identity
  tile and a chevron, all stacked, one VoiceOver label; without `onPress` it is the same
  row read-only. `CurrencyField` uses it ("Moneda / Dólares estadounidenses / USD · US$")
  for Nueva cuenta and, read-only, for Editar cuenta; the compact `AccountField` and
  `CategoryField` use it too. `DetailRow` gains `layout`: `auto` stacks a pair longer than
  30 characters (and any pair at large text) so a value never wraps into right-aligned
  fragments; `inline` keeps short facts such as the date on one line.
- [x] **AmountField** (`src/ui/components.tsx`, `src/ui/geometry.ts`): the symbol is
  anchored at the row's left edge and the input fills the rest of the row, left-aligned,
  in tabular figures; a keystroke only adds glyphs at the right. `amountFieldLayout` now
  returns a size only (no inset, no position): the font steps down solely when the whole
  amount would not fit beside the symbol, the gap and the caret. No Reanimated, no layout
  animation, nothing to respect under Reduce Motion because nothing moves. The canonical
  edit model (`money-input.ts`), grouping, decimals, mid-string editing, backspace over a
  dot, paste and the caret logic are untouched, as is `parseMinorUnits`. The field reads
  left-aligned like the Home hero; `AmountShortcut` follows it.
- [x] **Overflow audit, shared fixes.** `useStacked()` is the one threshold (font scale
  above 1.2) for every row that puts a name beside an amount (`EntryRow`, `AccountRow`,
  `TransferRow`, `DetailRow`, ranked categories, the card form's two day fields, the two
  Home segmented controls). `Stat` may shrink and `StatRow` lays two or three statistics
  side by side, one under the other at large text (Presupuestos, Cuenta, Tarjetas, the
  card detail, Recurrentes, Deudas). `Choice` labels cap scaling at 1.3× and fit their
  segment instead of truncating. `SelectorCard`, Recurrentes, Reportes merchants and
  budgets, Home rows, debts, categories and the Assistant draft show names on up to two
  lines with the amount column bounded at half the row. "Deuda registrada · ARS",
  "Pagos · ARS", "Gastado · ARS", the day header net, the Save-button echo and the
  transfer preview join their currency with non-breaking spaces (`withCurrencyCode`,
  `codedAmount`, `moneyText`), so a code or a number never sits alone on a line.
  Reportes' budget rows put "spent de limit" under the name instead of a fixed 44 pt
  percent box. Not changed: the card face's fixed aspect ratio and the donut centre
  (listed for device review), and every screen-local hardcoded `fontSize`.
- [x] **Localization foundation** (`src/i18n/`): `locale.ts` (es-AR and en-US as
  `AppLocale`, language and region derived from it, `resolveLocale` from the device list
  and a stored preference, `RELEASED_LOCALES` gating English until Producto 23.1),
  `format.ts` (dates from tables, never the device's ICU: "22 sep 2026", "martes, 22 de
  septiembre de 2026", "septiembre de 2026" / "Sep 22, 2026"; relative day names; date
  and time; counts; percentages; `formatAmount` that is byte-identical to
  `formatMinorUnits` in Spanish and only swaps separators in English; symbols "$"/"US$"
  and, in English, "AR$"/"US$"; spoken amounts; currency names), typed catalogues
  (`messages/es-AR.ts`, `messages/en-US.ts`, `translate` with placeholders and one/other
  plurals; a test proves both carry the same keys and placeholders), `device.ts`
  (expo-localization through a lazy `require`, Hermes Intl as fallback, never a throw),
  `preference.ts` (the language choice in expo-sqlite's key-value store, outside the
  ledger and outside backups; read and validated now, written by the next phase's
  screen) and `provider.tsx` (`I18nProvider` in the root layout, `useI18n()` giving the
  translator and the formatters bound to the resolved locale). Language, region, an
  account's currency and the stored integer amount are four separate things; no stored
  string or amount is rewritten.
- [x] **First integration.** Shared components read the catalogue: the selection sheets
  (Cancelar / Listo), the amount field's label, VoiceOver name and keyboard button, the
  information glyph, the account, category, date and currency selectors, currency names
  and the reason the list is short. Every `toLocaleDateString('es-AR', …)` in the app
  (day, entry and transfer detail, budgets, Reportes month, Home month, backup date) now
  goes through `formatDate` / `formatMonth`, so the DateField reads "22 sep 2026" like the
  rows instead of the device's "22 de sept de 2026"; percentages go through
  `formatPercent` (non-breaking space before "%"). The remaining screen copy is still
  Spanish literals: Producto 23.1.
- [x] **Dependency:** `expo-localization@~57.0.2` (the Expo SDK 57 module; bundled in
  Expo Go, so Metro is enough there). FinanzApp Dev needs a new development build to
  contain it; an older build falls back to Intl through the probed loader (see the
  device-blocker entry below: the first version of this fallback did not prevent
  Metro's red screen). Its config plugin is not enabled:
  `supportedLocales` (which lists the app's languages for iOS Settings) belongs to 23.1.
- [x] **Checked on Linux:** 297 mobile tests (14 new: `i18n.node.ts`, the anchored amount
  field in `typography.node.ts`, SelectionRow, DetailRow stacking, StatRow, segmented caps
  and the read-only currency row in `ui-rows.node.ts`; every route harness mocks
  `src/i18n`), TypeScript, Expo dependency check, dependency tree, audit, Metro iOS
  export, 397 root tests, Vite build, repo hygiene.
- [x] **Review follow-up (2026-09-22, same PR).** Names and merchants beside an amount
  had one line at normal text sizes and only expanded at large text. `EntryRow`,
  `AccountRow`, `TransferRow`, the ranked and legend category rows, Recurrentes and
  upcoming rows, debts and Reportes merchants now give the name (and its detail line)
  two lines at every size, bound the amount column to 56 % of the row, and stack the
  amount under the name through one rule, `rowStacks` (`src/ui/geometry.ts`): always
  above the 1.2 text scale, and otherwise whenever the amount at its row size would not
  fit its share of the row on this screen width (a 13-digit price on any iPhone, a
  nine-digit one or a signed US$ amount on a 375 pt iPhone). Stacking is preferred to
  shrinking, so an amount is never truncated, never squeezed smaller than its
  neighbours, and never overlaps a name. `useStacked(amount?)` is the hook; rows
  without an amount keep the text-scale rule. Tests: `rowStacks` cases in
  `typography.node.ts`; EntryRow, AccountRow and TransferRow at normal, huge and large
  text in `ui-rows.node.ts` (the harness now uses the real geometry and money
  formatter). Roadmap: the vigente order (23.1 internationalization, 24 multi-currency,
  the real Assistant afterwards) is reconciled with the historical entries, which keep
  their text with a "superseded" note; the AI draft rule is stated once for every
  phase; the AI cost/limit/quota/abuse backlog is listed, not built.
- [x] **Device blocker fixed (2026-09-22, same PR).** The owner approved the rows, the
  selectors and the amount layout on the iPhone; FinanzApp Dev (built before this PR)
  then showed "Cannot find native module 'ExpoLocalization'" from `deviceLocales()` /
  `startupLocale()` / `I18nProvider`. Cause: expo-localization binds its module while
  it is evaluated, and Metro's dev runtime reports a throw during module initialisation
  even when the caller catches it. Fix: `src/i18n/device-runtime.ts` probes
  `requireOptionalNativeModule('ExpoLocalization')` (from `expo`) and evaluates the
  package only when it is registered; `src/i18n/device.ts` is the pure reader (native
  list, else Intl, else empty → Spanish) and no longer catches faults of a registered
  module; `startupLocale` has no broad catch. The Más footer names the source of this
  launch. `expo-modules-autolinking resolve --platform ios` lists expo-localization /
  ExpoLocalization, so a new development build links it; that the rebuilt iPhone app
  reads "Idioma: módulo nativo" is still to be seen on the device. Tests: module
  registered, module absent (the loader is never called), a registered module's fault
  propagates, and a source guard (only the runtime adapter requires the package, only
  after the probe, never statically). No design change.
- [ ] **Not device-verified:** the old dev build starting without the red screen and the
  rebuilt one reporting the native module; the anchored amount field while typing fast, at the
  grouping transitions, with decimals, pasting, backspace over a dot, a tap in the middle,
  ARS/USD switch and the largest Dynamic Type; the currency row and sheet; stacked
  statistics and rows at large text on a narrow iPhone; long names and 13-digit amounts
  in the rows at normal text on a 375 pt iPhone; segmented labels at large text; both
  themes; VoiceOver on the new rows. See the checklist.

### Previous delivery — Producto 22.1

Producto 22.1 — UI Clarity & Form Polish is a focused refinement after the development
build started working: rows that read as title over subtitle, shorter forms with
progressive disclosure, a native currency row. No redesign, no financial change.

- [x] **Problems found.** Más rows rendered title and description as a label/value pair
  on one line, so "Deudas y cobros" and "Debo · me deben" competed and could clip at
  large text; the Reportes row "Comparar con el mes anterior / Por categoría" wrapped
  its right-hand text into short lines; the backup import row had the same shape; Nueva
  cuenta carried a three-sentence paragraph under Saldo inicial and a permanent
  ARS/USD segmented control; Editar cuenta carried two paragraphs; empty states used a
  56 pt glyph and a title2 headline inside a tall card.
- [x] **NavigationRow** (`src/ui/components.tsx`): leading tinted tile or neutral glyph
  in a fixed 30 pt column, title (weight 600) over a footnote subtitle, each up to two
  lines, a chevron, 60 pt minimum height, `title, subtitle` as one VoiceOver label.
  Used by Más → Finanzas (34 pt tiles) and App y datos (neutral glyphs), Reportes →
  Comparar ("Diferencias por categoría") and Copia de seguridad → Importar copia.
  `DetailRow` stays for label/value facts (detail screens, selectors, previews).
- [x] **FieldNote / InfoButton**: one short line under a field and an information
  glyph that opens the full explanation in a native alert. Nueva cuenta: "Opcional. No
  cuenta como ingreso." with the complete saldo inicial text behind it; Editar cuenta:
  "Solo para corregir un saldo mal cargado." and "La moneda de una cuenta no se cambia."
  with their full explanations. Nothing financial was removed, only moved one tap away.
- [x] **CurrencyField** (`src/ui/form-controls.tsx`, `src/ui/currencies.ts`): a grouped
  row "Moneda · Pesos argentinos · ARS" with a chevron opening a page sheet that lists
  ARS and USD (name, code, symbol, checkmark, one selection haptic) and says why the
  list is short. Only the two currencies the ledger holds; `searchCurrencies` and the
  option shape are the seed of the searchable currency screen of the next phase. The
  currency stays visible and changeable before the account exists; an existing
  account still cannot change it.
- [x] **EmptyState**: one calm card (44 pt glyph, title3 headline, one subhead line,
  22 pt vertical padding) across every screen that uses it.
- [x] **Checked on Linux:** 283 mobile tests (5 new in `ui-rows.node.ts`; Más, backup,
  account-form and selector guards updated), TypeScript, Expo dependency check, Metro
  iOS export, 397 root tests, Vite build, repo hygiene.
- [ ] **Not device-verified:** Más and Reportes rows at the largest Dynamic Type sizes
  and on a narrow width, the currency sheet, the information alerts with VoiceOver,
  Nueva cuenta scrolling with the keyboard on a small iPhone, both themes.

### Previous delivery — Producto 22

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
- [x] **Startup regression and fix (2026-09-21, second push).** The owner's first
  device run closed Expo Go right after the bundle loaded. Not reproduced on Linux (no
  device); cause narrowed by reading the installed native code: a JavaScript guard
  cannot prevent a native abort, and Producto 22 mounted five native `GlassView`s at
  startup (Home circles and the always-mounted composer). Expo modules' JS side only
  warns when a view config is missing, then the Fabric initializer calls `fatalError`
  ("Cannot create a view 'GlassView' from module 'ExpoGlassEffect'") when the running
  binary cannot create the view; a prop conversion failure is swallowed (`try?`), so the
  tint is not it. Most likely cause: the Expo Go binary's embedded glass module or its
  glass path differing from the 57.0.3 module in the lockfile. Fix: an adapter boundary
  (`src/ui/material.tsx`) that never imports `expo-glass-effect` statically (its JS binds
  the native view at evaluation time) and loads it lazily, once, only when `loadReason`
  allows: not Expo Go (`expo-constants` `expoGoConfig` / `appOwnership`), not switched
  off (`EXPO_PUBLIC_DISABLE_GLASS=1`), iOS, and `ExpoGlassEffect.GlassView` registered in
  the running binary (`globalThis.expo.getViewConfig`, which answers null). **Expo Go
  therefore always gets the opaque material and never evaluates the module.** The
  Reduce Transparency query and listener are feature-detected (`subscribeReduceTransparency`)
  and default to opaque. Más's footer names the active material and why.
- [x] **Material policy** (`src/ui/material-policy.ts`, pure): `loadReason` (disabled,
  expo-go, platform, not-registered) then `drawReason` (`isLiquidGlassAvailable()`, the
  runtime API `isGlassEffectAPIAvailable()` that some iOS 26 betas lack, Reduce
  Transparency live in `UIProvider`, defaulting to on until iOS answers). Glass is a
  development-build (expo-dev-client) capability, where the embedded module is the one
  in the lockfile. `expo-glass-effect@~57.0.3` is declared explicitly (already installed
  through expo-router); expo-doctor 21/21, `expo install --check`, `npm ls`, audit clean.
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
- [x] **Checked on Linux:** 275 mobile tests (9 in `material.node.ts`: load and draw
  matrices, kill switch, Expo Go, unregistered view, failing or throwing module,
  accessibility API missing or throwing, adapter-only lazy require), TypeScript,
  expo-doctor, Expo dependency check, `npm ls --all`, `npm audit` (0), Metro iOS export,
  397 root tests, Vite build, repo hygiene.
- [x] **Worklet boundary (2026-09-22, fourth push).** The owner's retest surfaced the
  concrete startup error: "[Worklets] Tried to synchronously call a Remote Function.
  Called composerBottomPadding on the UI Runtime", from `useAnimatedStyle` in the
  composer. `composerBottomPadding` was an ordinary imported function, so the animated
  style held a remote reference. Fix: the `'worklet'` directive as the first statement
  of its body (`material-policy.ts`); keyboard geometry unchanged. Audit of every
  `useAnimatedStyle` / `useAnimatedProps` / scroll handler in `src/ui` and `app`: the
  only other imported helper on the UI runtime, `arcPath` in charts, already carried
  the directive. Guard: `tests/worklets.node.ts` compiles every animated file with
  `babel-preset-expo` as Metro does for iOS (Worklets plugin 0.10.1 included), reads
  the emitted worklets and closures back, and fails when a captured function is not a
  worklet; removing the directive makes it fail. That proves the plugin output, not the
  iOS runtime: the iPhone retest has the final word.
- [x] **EAS link (2026-09-21, third push).** The owner created the EAS project
  `@facur3/finanzapp-mobile` (`b1cd9780-7e6a-4de3-9248-d446d0c77520`); `eas init` could
  not write the dynamic config, so `app.config.ts` now carries that ID and
  `owner: 'facur3'` as defaults, with `EXPO_PUBLIC_EAS_PROJECT_ID` still overriding
  (validated as a UUID). Bundle identifiers unchanged. Verified: `npx expo config
  --type public` shows the ID for both variants and the override, `npx eas-cli@latest
  project:info` resolves the project; `tests/app-config.node.ts` guards it. No
  credentials, devices or builds were touched.
- [ ] **Not device-verified:** that Expo Go now starts and stays open without the
  Worklets error (mode A with the kill switch, then mode B), the Más footer reading
  "Material opaco (Expo Go)", the
  composer resting on the tab bar and rising with the keyboard, the centre tab with
  VoiceOver and large text, Tarjetas from Más with its header "+". Glass itself (look,
  Reduce Transparency flip) waits for the development-build phase (written as
  "Producto 23" at the time; superseded, see the vigente order).

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
    opaque fallback). *Superseded (2026-09-22):* this entry once named "Producto 23"
    as the real cloud/text Assistant activation. Producto 23 became 23.0 (polish and
    the localization foundation) and 23.1 (full internationalization); Producto 24 is
    the multi-currency engine; the real Assistant activation comes after them (item 16).
12. ~~UI clarity and form polish~~ — delivered in Producto 22.1 (NavigationRow,
    FieldNote, CurrencyField, calmer empty states).
13. ~~Interaction polish and localization foundation~~ — delivered in Producto 23.0
    (SelectionRow, anchored amount field, overflow audit, `src/i18n` with es-AR and
    en-US catalogues, English not yet released).
14. **Producto 23.1 — complete internationalization**, in four PRs: **23.1A**
    (reactive language/region architecture, the Idioma preference; delivered),
    **23.1B1** (navigation, Inicio, Movimientos, main forms and shared components through
    the catalogue; delivered), **23.1B2** (remaining financial screens, Reportes,
    Tarjetas, Deudas, Recurrentes, backup and the Asistente; English complete but gated;
    modular catalogues and the tooling for many languages; delivered),
    **23.1C1** (regional money formats, amount-field separators, VoiceOver amounts and
    the date picker's locale for the four combinations, still gated; delivered) and
    **23.1C2** (the US region and English released, `supportedLocales`, a new EAS build;
    delivered in code, device QA pending). Original scope: every screen's copy in the
    catalogue, English released (`RELEASED_LOCALES`), `expo-localization`'s
    `supportedLocales` plugin (a native rebuild), locale-aware money presentation in
    `Money` and the amount field's separators, VoiceOver strings, date pickers and the
    Assistant copy. Requirements fixed now: **language and region are chosen
    independently** (the interface language and the writing conventions for dates,
    numbers and amounts are two preferences: a person can read English with Argentine
    formats or Spanish with US formats; `AppLocale` therefore splits into a language
    preference and a region preference, with "follow the device" as the default of
    each, both in the key-value store, neither in the ledger or backups); and
    **changing the language inside the app updates the interface correctly**: the
    provider re-binds the translator and formatters and every mounted screen, header,
    tab label, sheet and VoiceOver string re-renders in place, without a restart and
    without losing the current screen, a draft being typed or the Assistant
    conversation (a test drives the switch on a mounted tree; the iPhone confirms the
    navigation headers, which expo-router sets from options).
15. **Producto 24 — multi-currency engine:** currencies beyond ARS and USD only with
    dated exchange rates in the domain, the searchable currency screen the sheet
    seeds, per-account currency identity everywhere, reports that never add
    currencies without a rate. Not before the domain and its tests exist. Rules fixed
    now: **each account keeps its own currency** as a property of the account (its
    balance, movements, transfers, budgets and reports stay in that currency; a
    currency is never converted in storage and an account never changes currency);
    an **optional main currency for reports** may express totals across accounts only
    through **explicit, traceable conversions**: each converted figure carries the
    rate used, its date and its source, the report shows that it is converted and at
    which rate, an unknown rate yields "unknown" rather than a guessed number, and the
    rate table is user data with history (never a fabricated market series). Same-day
    ARS/USD transfers inside the ledger still need the person's own dated rate.
16. Then, in order: first-entry onboarding, financial productivity (backlog below),
    the real cloud/text Assistant activation with quotas and cost control (its cost and
    abuse controls listed under "Activate smart capture" must exist before any paid
    call), Apple integrations on the development build (Face ID, notifications with the
    card due-date reminder, Apple Pay capture, App Intents), monetization, brand and
    launch. The multi-currency engine (item 15) precedes them.
17. **Financial productivity backlog** (ordered by the owner's priority; each a focused
    PR with its own domain tests, none started):
    - Card form and calendar: a clearer card form and a real calendar for closing and due
      days.
    - Real closing and due dates per statement (each statement carries its own dates
      instead of a fixed monthly day).
    - Notifications and reminders (opt-in, local first, private content by default,
      deduplicated; device evidence required).
    - Financial goals (target, date, progress from recorded movements; no simulated
      returns).
    - Rollover budgets (unused budget carried to the next month, explicit and reversible).
    - Split expenses and tags (a movement split across categories or people; free tags
      that never replace the category).
    - CSV import and categorisation rules (a reviewed draft before anything is written;
      rules only pre-fill).
    - Reports and search improvements (account and custom-period filters, saved searches).
18. **Future optional expansion (not planned, no dependency added now):** CEDEARs, ETFs,
    cryptocurrencies and broker connections. They stay outside the native scope of
    decision 002 until a separate decision with official data access, dated quotes and
    user consent; nothing in the ledger, schema or dependencies anticipates them.

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

**Rule for every phase, past and future: an AI-generated movement is a draft until
the person confirms it explicitly.** Confirmar on the draft card is the only path that
writes an Entry to SQLite; Apple Pay captures, Shortcut messages, audio transcriptions
and inbox deliveries produce drafts in the review tray, never ledger rows. There is no
"auto-registration" mode in the product: the earlier wording below that allowed an
opt-in automatic write for "complete supported operations" is withdrawn (2026-09-22)
and kept only as history.

- [ ] Staging Supabase setup, mobile sign-in and cloud-data consent; no login needed
  for the local core. The existing web snapshot is not a mobile sync engine.
- [x] Text assistant UI (Producto 21: conversation, drafts, clarifications, evidence,
  disconnected state). [ ] Audio/transcription with explicit mic permission, limits and
  deletion (development build). Review/edit/undo with no phantom success or discarded draft.
- [ ] Evaluate Spanish phrases, ambiguous categories, currencies, loans/refunds,
  questions and failure handling with owned test data and measured provider usage.
- ~~Safe auto-registration opt-in only for complete supported operations and
  owned account/card mappings.~~ *Superseded (2026-09-22):* no automatic write of any
  kind; complete and ambiguous messages alike become drafts that require explicit
  confirmation before SQLite changes. Owned account/card mappings only pre-fill a draft.
- [ ] Scoped/revocable Shortcut pairing token; current base endpoint uses session
  JWT and is not a turnkey background Shortcut integration.
- [ ] Durable inbox → local review tray → acknowledgement, repeated delivery after
  edits/deletions and cross-device conflict tests before any background ingestion.
  Ingestion fills the tray; the receipt in SQLite is the draft's arrival, not a movement.
- [ ] Actual iPhone Apple Pay transaction trigger, available fields, missing amount,
  duplicate triggers, offline catch-up and cancellation verified without bank execution.
- [ ] Explain only deterministic facts, disclose partial records, and link supporting
  movements. Savings plans need goals/timeframe and explicit assumptions.
- [ ] **Cost and abuse controls before the first paid call (backlog, not built):**
  evaluate cost per model (input/output tokens, per request and per typical
  conversation, for each candidate model) with owned test data; daily and monthly
  limits per user, enforced server-side and shown in the app before they are hit; a
  token budget per request and per conversation (prompt trimming, evidence caps,
  a hard stop rather than a silent truncation); provider quotas and rate limits mapped
  to graceful states (the disconnected note, "try later"), never a retry storm;
  abuse protection (per-user and per-device rate limits, request signing tied to the
  session, anomaly cut-offs, a kill switch the owner controls, no anonymous endpoint);
  a monthly spend ceiling on the provider account and alerts before it. None of these
  services exist yet and none is implemented in this phase.

### 3. Commitments and cards

- [ ] Debo / me deben, due dates, partial payments and recoverable history.
- [ ] Loan principal is separate from income/consumption; interest/fees have categories.
- [ ] Debit/credit payment method, purchase, installments and due date.
- [ ] Purchase counted once; installment/payment reduces obligation without a second
  expense. Early payment removes that amount from later scheduled payments.
- [ ] Cash outflow, recorded expense and future commitment have distinct labels.
- [ ] No native FCI redemption, broker portfolio or simulated bank/card payment.

### 4. Independent build, Apple and optional sync

- [x] Link owner's EAS project (`@facur3/finanzapp-mobile`, Producto 22). [ ] Enroll
  Apple when ready for a signed preview; the Expo Go design/ledger step does not need
  a paid build.
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
Motion; text and financial values are never hidden until an animation finishes. The
amount field does not animate layout at all: its symbol is anchored and its digits
grow from a fixed origin. One
haptic per user action, always paired with a visual. Category hues come from
`src/ui/category-color.ts` and never replace a name. Colour tokens live in
`src/ui/palette.ts`: the cobalt primary marks interaction and selection only, the
semantic colours carry meaning, normal text stays neutral, and any new use of the
primary must keep 4.5:1 (see `tests/theme.node.ts`). Money input goes through
`src/ui/money-input.ts` and the domain parser; never format with floats. Dates,
percentages and prose amounts go through `src/i18n/format.ts` (tables, non-breaking
joins), labels through the `src/i18n` catalogues; a row that puts a name beside an
amount uses `useStacked()` and gives the name two lines. 44-point targets, VoiceOver,
safe areas, system text and separate currencies apply to every new screen.

## Handoff log (historical evidence)

### 2026-09-24 — Producto 23.1C2: English and the United States released

- English and the US region released and declared to iOS (`supportedLocales`,
  development region es, per-app language row); Idioma and Región in Más for everyone;
  device changes re-read on foreground and on iOS's locale event; ungrouped VoiceOver
  numbers, spoken twins and `accessibilityLanguage` on a mismatch; the date wheel on the
  language's home locale; Assistant failures and income chips fixed, no language sent (v2
  designed); bilingual copy review; tests proving release bundles ignore the preview flag.
- **Checked on Linux:** 454 mobile tests and the checks listed under the current delivery.
  **Not device-verified.** Needs a new EAS development build (owner).
- **Next:** build and install FinanzApp Dev, device QA with the 23.1C2 checklist. Producto 24
  (currencies) has not started.

### 2026-09-24 — Producto 23.1C1: regional formats and the internationalized amount field

- The amount field types and pastes in the region's separators with the 23.0 design and
  a ledger-notation draft; ambiguous pastes are refused with a note; region switches keep
  value, draft and caret; every visible amount goes through the region formatters and
  every VoiceOver amount through the language's; the date wheel takes the interface
  locale; English and the US region stay gated, with a development-only preview flag.
- **Checked on Linux:** 388 mobile tests and the checks listed under the current
  delivery. **Not device-verified.** No native rebuild needed.
- **Next:** device QA with the 23.1C1 checklist, then Producto 23.1C2 (release,
  `supportedLocales`, EAS build). Producto 24 has not started.

### 2026-09-24 — Producto 23.1B2: translation of the remaining screens and multi-language tooling

- Every remaining screen reads the catalogues; English complete (≈1 090 keys) and still
  unreleased; catalogues split into per-area modules with one typed entry; CLDR plurals;
  every domain/storage error catalogued (templates included); transfer titles derived by
  the form instead of travelling in the URL; debt accounts displayed from the debt;
  built-in categories localized with identities untouched; the Asistente's interface
  translated while model output and protocol labels stay as they are; local tools
  (`i18n:extract`, `i18n:check`, `i18n:export`, pseudo-locales, glossary) and
  `docs/i18n.md` (process for new languages, AI-assisted translation, Crowdin plan, RTL,
  library evaluation, error-code migration).
- **Checked on Linux:** 372 mobile tests and the checks listed under the current
  delivery. **Not device-verified.** No native rebuild needed.
- **Next:** Producto 23.1C (list under the current delivery).

### 2026-09-23 — Producto 23.1B1: translation of navigation, Inicio, Movimientos and main forms

- Navigation (tab labels, header actions, every stack header), the loading/failure
  screens, Inicio, quick actions, Movimientos, movement and transfer details, the
  spending period, Movimientos deshechos, the movement modal, the entry and transfer
  forms and the shared rows/selectors read the catalogues; Spanish output unchanged byte
  for byte; English complete for these keys and still unreleased. Built-in categories
  show a localized name with the same stored string, key, budgets and history; custom,
  renamed and historical categories are never translated. Errors are translated when
  shown (catalogue keys and known thrown messages). `AccountField` decides card/debt by
  the ledger kind, not by the label.
- **Checked on Linux:** 343 mobile tests, TypeScript, Expo dependency check, dependency
  tree, audit, Metro iOS export, 397 root tests, Vite build, repo hygiene. **Not
  device-verified:** Spanish unchanged on the iPhone; English layout only by length
  budgets until 23.1C releases it. No native rebuild needed.
- **Next:** 23.1B2 after this PR is approved (list under the current delivery).

### 2026-09-23 — Producto 23.1A: reactive language and region architecture

- Language and region split into two registries and two independent preferences
  (each "follow the device" by default, each with its own release gate); `AppLocale`
  is their composition, so the four es/en × AR/US combinations exist; words follow the
  language and separators, numeric date order, clock and "$" follow the region, with
  Argentine output byte-identical to 23.0; per-language catalogues; two key-value-store
  keys outside the ledger and backups; a live store (save first, gate enforced, device
  re-read on foreground) behind `useSyncExternalStore`, so a change re-renders only
  `useI18n()` consumers and never remounts the ledger, navigation, a form or the
  Assistant; Más → App y datos → Idioma with Según el dispositivo and Español
  (`CheckRow`). Región is built and tested but not linked until 23.1C (the amount field
  still types Argentine separators). English stays unreleased and unlisted.
- **Checked on Linux:** 323 mobile tests, TypeScript, Expo dependency check, dependency
  tree, audit, Metro iOS export, 397 root tests, Vite build, repo hygiene. **Not
  device-verified:** the Idioma row and screen (Dynamic Type, VoiceOver, themes,
  Reduce Transparency), persistence across a force quit. No native rebuild needed.
- **Left for 23.1B/23.1C:** listed under the current delivery.

### 2026-09-22 — Producto 23.0: interaction polish and localization foundation

- A stacked `SelectionRow` for the currency, account and category selectors (the
  currency code never wraps alone), `DetailRow` that stacks long pairs, an amount field
  with an anchored symbol and a left-aligned digit region whose only variable is the
  size, one `useStacked()` threshold, `Stat`/`StatRow`, capped segmented labels, two-line
  names beside bounded amount columns, non-breaking joins for currency codes and
  amounts; `src/i18n` (locale resolution with a release gate, table-based date and
  number formats, typed es-AR/en-US catalogues, device and preference adapters, a
  provider) integrated into the shared components and every date label. New dependency
  `expo-localization` (in Expo Go; a development-build rebuild picks up its native
  module, the Intl fallback covers it meanwhile). No domain, schema, backup or cloud change.
- **Checked on Linux:** 297 mobile tests, TypeScript, Expo dependency check, dependency
  tree, audit, Metro iOS export, 397 root tests, Vite build, repo hygiene. **Not
  device-verified:** the amount field's typing feel and caret at the grouping
  transitions, the stacked rows and statistics at large text and on a narrow iPhone,
  the currency row and sheet, both themes, VoiceOver.
- **Left for 23.1:** all screen copy, English release, the language and region
  preferences (chosen independently, switchable in place), `supportedLocales`,
  locale-aware `Money` and amount separators. **Noted, not done:** the card face's
  fixed aspect ratio and the donut centre at the largest text sizes; screen-local
  hardcoded `fontSize` values.
- **Review follow-up, same day and PR:** two-line names at every size and
  amount-aware stacking (`rowStacks`) in every name-beside-amount row; roadmap
  reconciled (superseded notes, one AI draft-confirmation rule, AI cost and abuse
  backlog, 23.1 language/region and in-place switch requirements, 24 per-account
  currency and traceable conversions). 299 mobile tests.

### 2026-09-22 — Producto 22.1: UI clarity and form polish

- One navigation row (title over subtitle, tile or glyph, chevron) for Más, Reportes →
  Comparar and the backup import row; short field notes with an information glyph in
  the account forms; a native currency row with an ARS/USD sheet ready for the future
  currency screen; calmer empty states. No domain, schema, backup, cloud or native change.
- **Checked on Linux:** 283 mobile tests, TypeScript, Expo dependency check, Metro iOS
  export, 397 root tests, Vite build, repo hygiene. **Not device-verified:** Dynamic
  Type and narrow-width wrapping of the rows, the currency sheet, VoiceOver on the
  information glyphs, small-iPhone scrolling in Nueva cuenta.

### 2026-09-21 — Producto 22: AI reachability and native material

- Assistant as the centre tab (tab root, Home action navigates to it), Tarjetas moved
  from the bar to Más → Finanzas as a pushed screen with its header action, a pure
  material policy plus `ControlSurface`, native Liquid Glass through `expo-glass-effect`
  (already bundled in Expo Go SDK 57) on the four Home actions and the composer only,
  opaque Producto 21 material everywhere else and whenever any condition fails, Reduce
  Transparency subscription, tab-bar-aware composer padding. No financial change.
- **Device regression (owner, 2026-09-21):** Expo Go loaded the project, then closed.
  Fix pushed to the same PR: lazy adapter boundary, Expo Go forced opaque, kill switch,
  registry pre-flight, feature-detected accessibility API (see the status section).
- **Checked on Linux:** 275 mobile tests, TypeScript, expo-doctor, Expo dependency
  check, dependency tree and audit, Metro iOS export, 397 root tests, Vite build, repo
  hygiene. **Not device-verified:** Expo Go startup after the fix (modes A and B),
  composer over the tab bar and keyboard, centre tab with VoiceOver and large text;
  glass look and Reduce Transparency flip wait for the development build.

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
