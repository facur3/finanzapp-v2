# Physical iPhone acceptance checklist

## Interfaz 09 — Home, budgets and Assistant preview (pending device review)

Use the existing pilot data and save a private backup first. Do not create fake
transactions just to fill charts and do not uninstall the only copy of the app.

- [ ] Ajustes footer reads Interfaz 09 and existing accounts/movements/recurrentes remain unchanged.
- [ ] Inicio → Gastos keeps the large expense total for the selected week/month and currency.
- [ ] Inicio → Disponible switches the hero without moving tabs and equals the sum of recorded accounts in that currency.
- [ ] Disponible is clearly labeled as recorded data, not bank sync or net worth.
- [ ] Switching Gastos / Disponible, ARS/USD and week/month feels immediate with no black frame.
- [ ] Sparkles in the Inicio header opens Assistant as a native modal/route, not a fourth tab.
- [ ] Assistant explicitly says Próximamente and does not request login, consent, microphone or network access.
- [ ] Presupuestos → create one category limit; Home and Presupuestos show the same remaining amount.
- [ ] Income and an internal transfer do not consume the budget; a matching expense does.
- [ ] A category expense over the limit shows Excedido without changing the account balance.
- [ ] A zero-spend budget has a visually empty progress bar; Reduce Motion applies values without animation.
- [ ] Editing a budget changes only the limit. Removing it hides the plan but preserves every movement.
- [ ] Month arrows cross December/January correctly and allow preparing a future month.
- [ ] ARS and USD budgets never combine.
- [ ] Exported native v5 backup lists budgets on review; reimport adds nothing twice.
- [ ] Updating from schema 4 preserves recurrentes, movements, transfers, balances and their exact cents.
- [ ] Light/dark, large text, VoiceOver and canceled edge/modal swipes remain readable/stable.

Cards/debts, real cloud AI, reminders, Face ID and Apple Pay are not part of
Interfaz 09 and should not be inferred from preview controls.

## Interfaz 07 — current product direction (pending)

- [ ] Footer identifies Interfaz 07. Existing records persist after reopen.
- [ ] Home main amount equals recorded expenses, not account balance or net worth.
- [ ] Week/month and currency update total, categories and recent records together.
- [ ] Bar/category detail contains exactly its date range/currency; back retains context.
- [ ] Accounts open from the header/Settings; no balance re-entry is required.
- [ ] Blank opening balance saves a zero tracking baseline, explained as such.
- [ ] Income-only/empty periods show no invented chart or savings claim.
- [ ] Both themes, large text, long amounts, VoiceOver and Reduce Motion work.
- [ ] Repeat canceled gestures and 30–40 tab changes without blank content.

Cloud AI/Shortcuts are not enabled or available through the UI yet. Do not enter
keys, configure a payment automation or expect captures to affect balances.
The older sections below are historical checks; Home balance/Tu mes references
were replaced by the current spending-first screen.


## Interfaz 06 — reports (physical review pending)

- [ ] Footer reads Interfaz 06; existing records/balances are unchanged.
- [ ] Inicio → Ver reporte → Día a día → day → expense → back preserves context.
- [ ] Only the selected currency/date expenses appear; no transfers/future days.
- [ ] Comparar gastos shows exact ranges; category totals open only those dates.
- [ ] Missing history shows insufficient information, not invented savings.
- [ ] Canceled swipes, fast tab changes, background/resume do not flash.
- [ ] Light/dark, VoiceOver, long amounts, large text and Reduce Motion work.

No JSON import/new data is required to inspect existing reports. Leap-year fixtures
belong only in automated tests; do not change the phone clock or seed fake records.

Status: **first Expo Go pilot accepted by the user on 2026-09-12**.
The user reported completing the Spanish guide, creating records, keeping them
after closing/reopening Expo Go, and fluid navigation that felt native on iPhone.
This is reported device evidence, not a signed-build or complete release result.

Device subsequently reported on 2026-09-12: **iPhone 14 Pro, iOS 26.6.1**.
The exact tested commit was not supplied. The available published first pilot
was `a5673bc`; do not infer that it was the installed revision.

Follow-up report after the first visual iteration: the user says the requested
basic checks work, **but Settings or Movements stays black intermittently, about
one in ten tab switches**. The visual style is explicitly not approved yet.
The new Interfaz 02 mitigation/design has not been re-tested on the phone.
Interfaz 03 adds Home/category reports and retains that mitigation unchanged.
Interfaz 04 adds correction/recovery without changing the tab mitigation.
No physical result for Interfaz 03 or 04 has been recorded yet.
Specific accessibility, background/airplane and release checks stay pending.

Record: date, device model, iOS version, build profile/number, commit, tester and
result. Do not commit screenshots containing actual balances, accounts or names.

## First device gate

- [ ] Cold launch shows one background/loading state; no fake dashboard or zero flash.
- [ ] Empty install contains no accounts, transactions or fabricated financial data.
- [ ] Add one account with an explicitly entered real opening balance.
- [x] Basic navigation and animations feel fluid on iPhone (user report, Expo Go).
- [ ] Expense/income sheet opens/closes smoothly; keyboard does not cover Save.
- [ ] Back from detail returns to the originating screen, not another tab.
- [ ] Tiny/canceled edge swipes do not navigate, blink or expose the wrong screen.
- [ ] Multiple fast Save taps produce one operation, not duplicate debits.
- [ ] `1.234,56`, `1234.56`, zero/negative/invalid input produce correct validation.
- [ ] A native date picker stays within safe areas; cancel preserves the date.
- [x] Entered expense/movement is still visible after closing and reopening Expo Go (user report).
- [ ] Force quit and airplane mode preserve the entered record and exact balance.
- [ ] Storage error blocks success, leaves the draft intact and offers retry; no reset.
- [ ] ARS and USD are displayed separately until a real exchange-rate feature exists.
- [ ] Exported pilot backup includes exactly the records shown; sharing is explicit.
- [ ] At largest accessibility text size, amounts wrap/shrink without hiding controls.
- [ ] VoiceOver announces actionable buttons and the selected account/type.
- [ ] Reduce Motion stops non-essential scale/slide effects.
- [ ] Dark/light system appearance has readable contrast and no white flashes.

## Later Apple gates

Before starting this section, repeat the new visual iteration checks below.
Face ID on iOS is not supported inside Expo Go; use our signed development build.

- [ ] Face ID allow/deny/cancel, passcode recovery, re-enrollment and app-switcher privacy.
- [ ] Reminder allow/deny/change time/disable; phone locked and app closed; Focus behavior.
- [ ] Apple sign-in first/repeat/cancel, hidden email, sign-out and account deletion.
- [ ] Shortcut on physical payment: record fields actually provided, never guess.
- [ ] Same Shortcut event repeated does not duplicate a debit; missing amount is a draft.
- [ ] Credit-card capture increases liability; debit-card capture updates the correct cash account.
- [ ] Refund/reversal and duplicate manual/Shortcut entries can be reconciled.

## Release gate

- [ ] Repeat core checks in optimized preview/TestFlight, not just Expo Go/debug mode.
- [ ] Test with computer turned off and network unavailable.
- [ ] Legacy import preview and exact balances/holdings match before/after, with backup.
- [ ] Cloud sync conflict/offline retry/account-switch tests preserve ownership and data.
- [ ] Review frame drops, cold start, scroll and memory with a sizeable private test dataset.
- [ ] Subscription purchase/restore/expiry/refund and user-data export/deletion pass.
- [ ] Privacy/security review and App Store declarations match what the build actually does.

## First visual iteration — basic flow reported working; tab regression open

- [x] Updating preserves existing records (user reports the requested basic checks passed).
- [ ] Home shows available cash, not complete net worth; currencies remain separate.
- [ ] Choosing USD on Home opens Gasto/Ingreso with an existing USD account selected.
- [x] Amount keyboard's Listo dismisses it (user report of the requested basic checks).
- [ ] Account chooser handles long names/many accounts and selects exactly one.
- [x] Date Cancelar/Listo works in the requested basic check (user report; swipe matrix still pending).
- [ ] Date, chooser toolbar, amount and Save fit at large text sizes and narrow widths.
- [ ] Search ignores case/accents; all query terms match concept/category/account.
- [ ] Expense/income filters and search remain after detail → back; rows are not duplicated.
- [ ] Today/yesterday labels update when the app resumes after midnight.
- [ ] Open/close/cancel small swipes in entries, accounts and sheets without another-tab flash.
- [ ] Light/dark, VoiceOver, Reduce Motion and private backup sharing checked again.
- [ ] Save and close/reopen still preserve the exact balances and one record per operation.

## Interfaz 02 — black-tab mitigation and categories (re-test pending)

- [ ] Footer in Ajustes shows **Interfaz 05**, including the Interfaz 02 mitigation.
- [ ] Perform 30–40 switches across Inicio → Ajustes → Movimientos in both directions.
- [ ] Repeat some switches quickly, before a previous press response finishes.
- [ ] Background/foreground the app, then repeat; Settings backup control always appears.
- [ ] Switch away/back with an activity filter/search active; query and records survive.
- [ ] Open a detail/form, cancel an edge/modal swipe, then switch tabs again.
- [ ] VoiceOver cannot focus hidden tabs; Reduce Motion and dark/light stay readable.
- [ ] Category chooser opens, searches and closes/cancels without changing the draft.
- [ ] Pick an existing/custom category and change income/expense without losing it.
- [ ] Existing labels and balances remain unchanged; emoji is presentation only.
- [ ] Tu mes matches recorded income/expenses in the selected currency through today.
- [ ] Opening balances and other currencies are excluded; no phantom income or FX.
- [ ] Large text/long amounts fit the balance card, month summary and category sheet.

If black content remains, record whether the header/tab bar is visible, if
switching tabs recovers it, whether it followed keyboard/background activity,
the theme and any red Metro error. Share only redacted error text, not balances
or private records. Do not reset SQLite, uninstall Expo Go or change Expo versions.

## Interfaz 03 — dashboard and monthly category reports (pending)

Use the small ledger already in the pilot; do not seed transactions to fill a chart.
The walkthrough is read-only and does not require another expense or income.

- [ ] Ajustes footer identifies **Interfaz 05** (contains Interfaz 03). Existing balances/entries are unchanged.
- [ ] Inicio → Ver cuentas opens the full list; back returns to Inicio.
- [ ] Tu mes shows at most three categories with amount/share of **all** expenses.
- [ ] More than three categories are explicitly identified as a partial preview.
- [ ] Ver reporte opens a native detail, with the same currency as Home.
- [ ] Month arrows stop at current month/earliest recorded month for that currency.
- [ ] Historical months include all days; current month includes only dates through today.
- [ ] Each category opens only matching expenses for that month and currency.
- [ ] Adding the displayed category movements equals that category's displayed total.
- [ ] Category → movement → back → report preserves month/currency and scroll position.
- [ ] Direct Home → category → movement → back → Home also returns to its actual origin.
- [ ] Tiny/canceled swipes never expose a different section or restart the chart.
- [ ] Changing month/currency updates proportions briefly, without animating monetary numbers.
- [ ] Reduce Motion applies the bar value immediately; screen readers announce label/amount/share.
- [ ] Empty or income-only months show no category bars, invented percentages or trend claims.
- [ ] Clear/dark, narrow screen and large text: category/amount/month labels remain readable.
- [ ] Report-only use preserves the private backup contents and all account balances.
- [ ] Repeat the 30–40 tab-switch check above; its physical verification remains open.

## Interfaz 04 — corrections and native backup recovery (pending)

Keep a private pilot backup before updating. Use existing pilot records, not fake
transactions; full restore into an empty install belongs on a separate isolated
test install, not by uninstalling the user's only copy. Do not downgrade schema 2.

- [ ] Update preserves all previous accounts/entries/cents after schema 1 → 2.
- [ ] Detail → Editar prefills amount/kind/concept/category/account/local date.
- [ ] Cancel/no-change Save does not change any balance or create a second entry.
- [ ] A real correction updates the original entry, its account, Home and report exactly once.
- [ ] Changing account restores the old balance and adjusts only the new same-currency account.
- [ ] Currency cannot silently change while editing; ARS and USD remain separate.
- [ ] Double Save and retries after a failure do not repeat a posting; failed draft stays visible.
- [ ] Deshacer confirms the specific amount/account effect; Cancelar changes nothing.
- [ ] Undone entry disappears from active reports/balances without creating income/refund.
- [ ] Detail stays visible with Recuperar, without jumping through Inicio/another tab.
- [ ] After close/reopen, Ajustes → Movimientos deshechos still offers recovery.
- [ ] Recuperar applies its original effect exactly once; repeat taps cannot double it.
- [ ] Updated bars reflect only real saved values, with no focus/scroll replay.
- [ ] Ajustes → Compartir copia saves native v3 JSON through Files; cancel does not claim success.
- [ ] Importar copia opens the iOS Files picker; cancel leaves the ledger unchanged.
- [ ] The same exported file previews as already present; no duplicate import action.
- [ ] Native v1/v2/v3 backup on an isolated empty install restores active and undone records/totals.
- [ ] Preview shows counts and before/after ARS/USD; Cancel/back never imports.
- [ ] Conflict/unsupported web/new schema/corrupt/oversized file shows an explanation without partial import.
- [ ] Local correction/undo is never overwritten/reactivated by an older backup.
- [ ] Closing/reopening after import preserves the imported result; repeat import adds nothing.
- [ ] Light/dark, large text, VoiceOver and Reduce Motion for edit/recovery/import screens.
- [ ] Return from edit/import or cancel a small swipe without the intermittent black-tab regression.

Automated cases use synthetic fixtures in disposable SQLite files; none are
inserted into the real app. Native file selection, sharing, gestures and appearance
still need physical evidence. The v3 snapshot does not export the full local edit
audit history; cloud/legacy migration and encryption remain separate gates.

## Interfaz 05 — accounts and internal transfers (pending)

The owner defers a combined visual review. No device result is claimed for this
delivery. Do not populate their app with test fixtures or delete the only install.

- [ ] Save a private backup before updating; the footer reads Interfaz 05 afterward.
- [ ] Existing v1/v2 pilot data upgrades in place with unchanged balances, entries and undone entries.
- [ ] Account → pencil opens name and **current available balance**, not just opening balance.
- [ ] Cancel/unchanged save writes nothing. Rename preserves every balance and entry.
- [ ] A deliberate correction clearly confirms old/new balance; only opening balance changes, not spending/income reports.
- [ ] Account currency is immutable; new-account from a USD transfer defaults to USD.
- [ ] Transferir is contextual to account detail, not another Home action/tab.
- [ ] Same-currency destination picker excludes source; changing source clears an incompatible target.
- [ ] Form previews both resulting balances; edit removes the old transfer effect first.
- [ ] One real transfer changes both account balances once and preserves currency total.
- [ ] Activity Todos/search/recent show the transfer once; expense/income filters/reports exclude it.
- [ ] Each account detail lists the transfer with its own direction/sign.
- [ ] Edit/undo/restore survives close/reopen; a repeat tap does not duplicate effects.
- [ ] Transfer detail changes to undone/recovered in place, without redirect/back-tab flash.
- [ ] Native v3 copy review lists new transfers and includes undone transfers in recovery.
- [ ] Light/dark, large text, VoiceOver, keyboard/date, Reduce Motion and canceled swipe are correct in every new route.

Automated handler tests are not a measurement of native fluidity. Bank execution,
foreign exchange, fees, legacy import, cloud sync and full audit export are not
included in this slice. Device logs/screenshots must exclude personal finances.


## Interfaz 08 — recurring commitments and upcoming payments (pending device review)

Automated storage/calendar checks are not visual acceptance. Use a private pilot
backup first and only small test amounts; do not uninstall the only copy of the app.

- [ ] Ajustes footer reads Interfaz 08 and Recurrentes opens without adding a fourth tab.
- [ ] Create one monthly expense recurrente with a future date; close/reopen and confirm no movement posts early.
- [ ] Create one recurrente due today; it appears once in Movimientos and its next date advances once.
- [ ] Close/reopen several times after that due date; the balance and movement count do not change again.
- [ ] A day-31 monthly rule shows the short-month date correctly and returns to day 31 when the calendar permits.
- [ ] Pause a rule, pass/change its date in test data, reopen, and verify no paused occurrence is posted.
- [ ] Reactivate it; dates elapsed while paused are skipped rather than silently charged.
- [ ] Account detail → Recurrentes filters to that account and creating from there preselects it.
- [ ] Inicio shows Próximos compromisos only when a real active expense rule exists in the selected currency.
- [ ] ARS and USD upcoming/30-day projections are never added together.
- [ ] Recurrentes bars animate smoothly; Reduce Motion removes the transition and values remain visible.
- [ ] Long concept/category/account names, large text and VoiceOver keep the amount/date understandable.
- [ ] Light/dark mode, small canceled back swipe and 30–40 tab/detail transitions do not reproduce the black-screen issue.
- [ ] Exported native v4 backup reviews recurring rules on import; re-importing the same copy adds nothing.
- [ ] Updating from schema 3 preserves existing accounts, movements, transfers, corrections and balances.

Local reminders, Face ID, Apple Pay, signed-device Apple integrations and bank
execution are not part of Interfaz 08. Test those only after their explicit EAS/
development-build gate is implemented.
