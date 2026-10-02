# Physical iPhone acceptance checklist

## Producto 25OPS1 — the last row above the dock (follow-up to 25UX1; on its branch; not tested)

**Not tested yet: this correction has not been on an iPhone.** It is the one open item of 25UX1's dock checklist (the
owner's pass of 2026-10-02, below). Metro from this branch (`npm run start:dev-client -- --clear`) on the installed
FinanzApp Dev build; JavaScript only, no native dependency, no EAS build. Start from a cold launch (quit FinanzApp from
the app switcher first). Record the iPhone model, iOS version, theme and text size with the result. Use your own test
data; never seed movements. The rest of 25OPS1 is documentation (`docs/production-plan.md`, `docs/app-store-launch.md`)
and has nothing to check on the iPhone.

What changed: the space that keeps a root's last row clear of the dock is now part of the content's layout (bottom
padding) on every platform, no longer an inset of the native scroll view; only the scroll indicator's inset is native.

- [ ] **Inicio:** scroll to the very end and lift the finger: the last movement of the recent activity rests fully above
      the pill, with air between it and the dock, and stays there (it does not spring back under the dock). Tap it: it
      opens.
- [ ] **Reportes:** at the end, «Comparar con el mes anterior» (or whatever the last element is that month) rests fully
      above the pill and responds to a tap.
- [ ] **Más:** at the end, the last row and the version line («FinanzApp 0.1.0 (25OPS1)», and the diagnostics line in a
      development build) are fully readable above the pill.
- [ ] **Movimientos:** at the end, the oldest movement rests fully above the pill and opens on a tap.
- [ ] On each of the four: an overscroll at the end (pull up and release) returns to that same resting position, not
      lower. The air above the dock is the same as on a pushed screen's end, not a long empty footer.
- [ ] The scroll indicator ends above the dock on the four roots. Note where it stops: just above the pill, or about
      34 pt higher (then iOS added the home-indicator inset on top of the clearance; cosmetic, recorded in the roadmap).
- [ ] **Movimientos search:** open the search and type: the results stay reachable above the keyboard; dismiss the
      keyboard: the dock is back, the list's end still rests above it, and the scroll indicator still ends above the
      dock (scroll once to see it).
- [ ] Open any form with a keyboard from the «+» (Gasto), save or cancel, return: the four roots still end above the
      dock and their indicators still end above it.
- [ ] After using the app for a while (open and close several pushed screens and modals, switch tabs 20 times, change
      the month in Reportes): repeat the first four checks. The result is the same as after the cold launch.
- [ ] Unchanged from 25UX1: no band behind the dock; taps in the empty margins beside and between the pill and the «+»
      reach the content; the capture hub's «×» sits on the «+»; a pushed screen (Tarjetas, an account) shows no dock and
      keeps its usual bottom padding; no black or blank root after fast tab switching.
- [ ] **VoiceOver:** swipe right through a long list (Movimientos) to its end: every row can be focused and opened with
      a double tap. Note separately whether a row that VoiceOver focuses while it sits **behind the pill** opens the row
      or presses a tab: that is a recorded risk of a floating dock (roadmap, 25OPS1), not something this correction
      claims to have settled.
- [ ] **Large text** (Settings → Accessibility → Larger Text, one accessibility size) and an iPhone without a home
      indicator, if one is at hand: the last row still rests above the dock.

## Producto 25UX1 — Dock, Cards and Reports interaction (merged as PR #80; owner's pass 2026-10-02, one item failed)

**No EAS build was made; the item-by-item pass is still open (see the owner's pass below).** Metro from `master`
(`npm run start:dev-client -- --clear`) on the installed FinanzApp Dev build; JavaScript only, no native dependency. Record the iPhone model, iOS
version, theme, language and text size with each result. Use your own small test data; never seed movements. Rules:
decision 005, «Enmienda 2026-10-02 — Producto 25UX1»; design: mobile-design.md, «Producto 25UX1».

**Owner's pass (2026-10-02, physical iPhone, FinanzApp Dev build; model, iOS version, theme and text size not
recorded).** Confirmed by the owner: the dock draws no rectangular footer or background; only the pill and the separate
«+» sit over the content, and the content visibly passes behind them; switching tabs works; the Tarjetas interaction
(idle, first tap selects, second opens) works; the Reportes interaction (the chosen category listed first) works.
**Failed:** at the end of the scroll the last content does not settle above the dock: on Inicio the last recent
movement stays partly behind the pill, on Reportes lower content such as «Comparar con el mes anterior» stays behind
it, on Más the diagnostics and version text stays behind it; an overscroll shows it, and on release it springs back
under the dock. Corrected in Producto 25OPS1 (section above), not yet tested on the iPhone. The boxes below stay
unticked: the pass was reported in these general terms, not item by item (Reduce Transparency, VoiceOver, landscape,
the six-card deck and Reduce Motion were not reported), so no individual line is marked done from it.

**Dock (no rectangle)**
- [ ] On Inicio, Movimientos, Reportes and Más, scroll so content passes under the dock: no white (light) or black (dark)
      band behind the pill and the «+»; only the pill, the «+» and the content around them. Light and dark.
- [ ] Settings → Accessibility → Display & Text Size → Reduce Transparency on: the pill is solid pine, still no band.
      Off again on an iOS that draws Liquid Glass: the pill blurs the content under it.
- [ ] Scroll each root to its very end: the last row (Inicio's last section, Movimientos' oldest movement, Reportes'
      last fact, Más' last row) rests fully above the dock with the same air as before; the scroll indicator stops
      above the dock. **Failed on the owner's pass (2026-10-02): the last content settled behind the pill.** Corrected
      in 25OPS1; check it with the 25OPS1 section above.
- [ ] Tap content right beside, between and just above the pill and the «+» (a row's edge): the row responds; the empty
      margins never swallow the tap. The four tabs and the «+» still respond across their whole targets.
- [ ] Movimientos: open the search, type: the keyboard covers the dock, the results stay reachable above the keyboard,
      dismissing it brings the dock back unchanged.
- [ ] The «+» opens the capture hub: its «×» sits exactly where the «+» was; the card floats above the dock; closing it
      returns to the same root.
- [ ] Switch tabs 30–40 times quickly (including from the middle of a scroll): never a black or blank root, no fade.
- [ ] A pushed screen (Tarjetas, a card, an account, Presupuestos) shows no dock and keeps its usual bottom padding.
- [ ] VoiceOver: the four tabs read «Inicio, pestaña, 1 de 4»… and the «+» as before; Large Content Viewer on a long press.
- [ ] Landscape (if the device allows it on a root): the dock clears the sensor housing, the last row is reachable.

**Tarjetas (Más → Tarjetas)**
- [ ] With two or more active cards: on entry no card is selected; the deck shows every card's identity, a quiet line
      «Tocá una tarjeta para ver su saldo y sus movimientos.» and no balance, dates, available amount, movements or
      button.
- [ ] With exactly one active card: the same idle state (its face, no figures).
- [ ] First tap on any card (a strip, and separately the whole card at the bottom): it moves to the front with the deck's
      slide, one selection haptic, and the snapshot appears: Saldo pendiente → Vence · Cierra → Disponible (or «No
      calculado con cuotas» / «Sin límite cargado») → «Pagar tarjeta» (disabled with nothing owed) → Recientes. No
      «Registrar compra», no future-instalments row.
- [ ] Tap another card: the old card's balance, dates, available amount and recent movements never flash beside the new
      ones; the new card comes forward smoothly.
- [ ] Tap the selected (front) card again: its detail opens. Back: the same card is still selected.
- [ ] Six cards: idle, then select the fourth: the page scrolls it into view if needed; strips stay 44 pt.
- [ ] Reduce Motion on: the card moves to the front at once; the snapshot still appears without movement.
- [ ] VoiceOver: an unselected card says «… Selecciona esta tarjeta y muestra su resumen»; after selecting, the card says
      «Seleccionado» and «Abre el detalle de la tarjeta»; the snapshot reads in its order.
- [ ] An archived card is only under «Archivadas» and opens its detail; archiving the selected card elsewhere returns
      Tarjetas to idle.
- [ ] Card detail with plans: the face and the facts at the top, the actions, then «Movimientos» (every movement), then
      «Cuotas» with every plan at the end; each plan still opens; Pagar tarjeta / Registrar compra as before.

**Reportes (Categorías)**
- [ ] A month with five or six categories: choose the fifth slice on the donut: its row visibly travels up to the first
      position while the rows above make room; it stays outlined, bold and tinted; its amount and percentage unchanged.
- [ ] Choose another slice: the previous row travels back to its place, the new one rises. Clear (tap the chosen slice
      or the hole): the canonical order returns, animated.
- [ ] No page auto-scroll: the chosen row is simply the first row under the donut.
- [ ] Change month, currency or the display mode with a slice chosen: the choice clears and the list shows the new order
      at once, without travelling rows. Categorías ↔ Día a día likewise.
- [ ] Reduce Motion on: the chosen row is first at once, no travel; clearing restores the order at once.
- [ ] VoiceOver: swipe up/down on the donut to choose; the chosen row is read first and its hint says «Elegida en el
      gráfico: se muestra primero mientras está elegida…»; nothing says it is the largest category.
- [ ] Large text (AX sizes): the rows reorder without overlapping; the donut's centre readout still fits.

## Producto 25A-02 — nothing to check on the iPhone (merged as PR #78 and #79)

The durable local review store (`apps/mobile/src/storage/review-database.ts`, its own file) is not opened by any screen
yet: no UI, no native dependency, no ledger schema or backup change, no EAS build. The only visible difference is the
version line at the end of Más: «FinanzApp 0.1.0 (25A-02)» on a build from this branch.

## Producto 25A-01 — nothing to check on the iPhone (merged as PR #77)

The review-draft domain model (`packages/domain/review-drafts.ts`) is pure domain: no screen, storage, schema or native
change, and no EAS build.

## Producto 24T3 — merged as PR #76; must pass before 25A-03, 25A-04, 25A-11 or 25A-12 merges

**Gate (owner, 2026-10-02).** The owner merged PR #76 (merge commit 399a1fa) after targeted use and deliberately deferred
this recorded pass: nothing below is checked. 25A-01 and 25A-02 may proceed; this pass must be done before 25A-03,
25A-04, 25A-11 or 25A-12 merges, because those begin to expose durable review of financial writes (transfers,
devoluciones, cuotas).

**Not done yet: no EAS build was made and the iPhone was not touched. Nothing below is device-verified.** This is a
short, targeted pass for devoluciones, the adelanto de cuotas and the plan lifecycle, and the final device QA of
instalments (Tarjetas and Deudas on the iPhone). The earlier sections 24UX6A–24UX6E stay unchecked as they are: they
belong to the later full pass before the first TestFlight, not to this gate. Metro from `master` (`npm run
start:dev-client -- --clear`) on the installed FinanzApp Dev build; JavaScript only, no native dependency.
**The ledger moves to schema 14 (two new empty tables) and an older build refuses the file unchanged: export a backup
first** (Más → Copia de seguridad). Use your own small test data (a test cash account, a test card, two or three test
purchases and one test plan); never seed movements, and undo or delete the test data afterwards. Record the iPhone
model, iOS version, theme, language and text size with each result. Design: [mobile-design.md](mobile-design.md)
(«Producto 24T3 — Devoluciones, adelanto de cuotas y ciclo de vida del plan»); rule: [decision 003](decisions/003-five-tabs-and-cards.md),
rule 7.

- [ ] **Upgrade.** With the backup exported, open the app over your data: Inicio, Movimientos, Tarjetas, Presupuestos
  and Reportes show the same figures as before; force-quit and reopen: nothing migrates twice. The Más footer reads
  «FinanzApp 0.1.0 (24T3)».
- [ ] **Cash devolución, partial then full.** On a cash purchase's detail, «Registrar devolución»: the preview says
  the account, the date, the category, the month and «No es un ingreso»; save a part: the account's balance rises by
  it, the purchase reads «Devuelto $ X de $ Y», Movimientos shows «Devolución · comercio» unsigned in ink with its own
  glyph, under Gastos and Todos and never under Ingresos. Then «Total disponible» and save the rest: «No queda nada por
  devolver» afterwards.
- [ ] **Card purchase devolución.** On a card purchase without instalments: the card's «Saldo pendiente» drops by the
  devolución and the cycle line counts it under «devoluciones», not as a purchase. A devolución after the card was paid
  leaves the card «a favor».
- [ ] **Plan devolución before and after a closing.** On a test plan with nothing recorded yet, a partial devolución:
  the preview says the last instalments go down and no credit goes to the card; the calendar shows them «Devuelta» or
  «Reducida por devolución: $ X». On a plan with recorded instalments, a devolución returns that part to the card first
  (the balance drops, «Devuelto a la tarjeta») and only the rest lowers the last instalments.
- [ ] **Devolución dated today, before noon (review fix).** Before 12:00, on a cash purchase made today, «Registrar
  devolución»: the date row reads today, the wheel opens on today and cannot go before the purchase or after today; save
  it: dated today. On an older purchase, the wheel still reaches the purchase's own day.
- [ ] **Account detail with net refunds (review fix).** On a test cash account, a devolución this month of a purchase
  from an earlier month that exceeds this month's purchases: the fact reads «Devoluciones netas este mes» with the
  excess, unsigned and in ink (never «Gastos este mes» with a minus, never green); VoiceOver reads «Devoluciones netas
  este mes: las devoluciones superan lo gastado en …»; the recorded balance rose by the devolución. In English: «Net
  refunds this month». With spending equal to the devoluciones: «Gastos este mes» $ 0.
- [ ] **Over-refund refused.** Typing more than «Total disponible» keeps Guardar off with the domain's sentence;
  nothing is written.
- [ ] **Adelanto without interest.** On a plan without interest, «Registrar adelanto de cuotas»: the covered
  instalments, the date bounded, the sentence that the payment is recorded apart; save: the card's balance due rises by
  the remaining price on that date, the calendar reads «Adelantada» (never «pagada»), the plan reads «Adelantado»,
  Movimientos shows «Adelanto de cuotas · comercio». «Pagar tarjeta» on the success state opens the payment to that card,
  capped at its balance (the amount is not prefilled); pay it: a transfer, no second expense.
- [ ] **Adelanto with interest, both choices.** On a plan with interest, Guardar stays off until a choice is made. «Los
  registro ahora»: the interest is recognised with the price, in its own category. Undo it, then «El emisor no los
  cobró»: only the price is recognised and the plan shows «Interés no cobrado»; a row never shows more than the balance
  holds.
- [ ] **Dejar de seguir and Reactivar.** On an active plan with history, «Dejar de seguir el plan»: the alert says what
  stops, that it is not a devolución or a payment, and first names an instalment that already closed if there is one;
  after it the plan reads «Sin seguimiento» with its note and «No se registra», and the recorded instalments stay.
  «Reactivar plan»: the plan is active again; if a closing passed while it was not tracked, the alert names those
  instalments and they are recorded once, on their own closing dates.
- [ ] **Deleting a card (owner review).** On a test card with a credit («a favor»), Eliminar tarjeta shows, before any
  destructive confirmation, «Todavía no se puede eliminar» with «Esta tarjeta todavía tiene saldo a favor de $ X. Podés
  archivarla para sacarla de tus tarjetas activas sin perder el saldo ni el historial.» and **Cancelar · Archivar
  tarjeta**; Archivar tarjeta archives it at once (it leaves the active cards, appears under Archivadas with the same
  balance and history). The same with a balance due (plus «Pagar»), with a pending plan, and with two of them at once
  (both named). An archived card says it already is and offers no archive. A test card created by mistake with nothing
  recorded is deleted after «¿Eliminar esta tarjeta?». After the plan is completed, stopped, fully returned or brought
  forward and the balance is zero, the card can be deleted. A plan with any devolución or adelanto never offers
  «Eliminar plan».
- [ ] **Devolución de compra versus a bank reintegro (owner review).** «Registrar devolución» shows the one-line note
  «Devolución de compra: …» under the purchase; its ⓘ explains that a reintegro, cashback or bank promotion is an
  income in the account that received it. In English: "Purchase refund: …". The note wraps at AX sizes; VoiceOver reads
  the note and the ⓘ as «Más información sobre devolución de compra». Choosing the income category «Reembolsos» says a
  bank reintegro is recorded there, as income.
- [ ] **Undo and restore.** From a devolución's detail, «Deshacer devolución»: it leaves the balances, reports and the
  purchase's «Devuelto»; Movimientos deshechos lists it under «Devoluciones y adelantos» with Restaurar; restore it: it
  is back once. The same for an adelanto: its confirmation names the instalments recorded on their closings and says
  when it cannot be restored. A purchase with a live devolución cannot be undone (the alert offers «Ver devoluciones»)
  and its edit cannot lower it below what was returned.
- [ ] **Movimientos.** Search «devolución» and «adelanto»; each row opens `/operation`, read-only, with its links to the
  purchase or plan and the account or card; back returns to the list.
- [ ] **Reportes with a category below zero.** A devolución in a later month than its purchase: that month's category
  reads «Sin gasto neto», listed last and not drawn in the donut; the centre shows the exact net; the bar sits at zero
  with the caption giving the net; a month with only devoluciones shows the quiet sentence instead of a donut;
  Presupuestos keeps Gastado exact and Disponible at the limit with «Las devoluciones superan lo gastado»; Inicio's
  Gastado shows the same line under the number.
- [ ] **The Reportes switch.** «Categorías | Día a día» at 375 pt (SE / 13 mini) in Spanish and English, at Text Size
  S, L and XXXL: the labels at the subhead size, never shrunk or cut, the chosen one semibold; the thumb, the haptic
  and VoiceOver as before.
- [ ] **Deudas unchanged.** A devolución never appears in Deudas y cobros as a payment or a collection; debt balances
  and totals are the same as before.
- [ ] **VoiceOver** on «Registrar devolución», «Registrar adelanto de cuotas», the operation detail, the plan detail's
  actions and alerts and the new calendar rows: the kind word first («Devolución», «Adelanto de cuotas»), amounts and
  dates in words, ranges such as «Cuotas 3–12» read sensibly, every action reachable.
- [ ] **Light and dark** on every new screen; text at AX sizes stacks without cutting a figure; the last button clears
  the home indicator.
- [ ] **Dock (no change; confirm only).** The pine pill and the «+» sit in the layout on the screen's canvas above the
  home indicator, not as a floating overlay (kept deliberately: no last row hides behind them, keyboard and safe areas
  stay deterministic, the mounted-tab black-screen mitigation is untouched). Confirm the last row of every root still
  scrolls clear of it.
- [ ] **Tarjetas density (evaluate only; no redesign in 24T3).** With 24T3 verified, note whether the Tarjetas root
  feels dense next to a more deck-focused, Wallet-inspired composition (the full movements and facts mainly after
  opening a card). The 24UX6D rule stays: one card is always in front and selected and drives the snapshot, tapping
  another card selects it, tapping the front card opens its detail; no «choose a card first» state.

Record: date, iPhone model, iOS version, build, language, and every result above (a failure with a screenshot of your
own test data only, never of real financial data).

## Producto 24UX6E — More financial destinations in Forest

**Not done in 24UX6E: no EAS build was made and the iPhone was not touched. Every item below is pending.**
Metro from this branch (`npm run start:dev-client -- --clear`) on the installed FinanzApp Dev build; JavaScript only
(Cuentas, Presupuestos, Recurrentes, Deudas y cobros, Categorías, the edit modals, Idioma / Región / Apariencia and
Movimientos deshechos), no native dependency, no domain, storage, schema (13), backup (v13) or FX change. Use your own
data; never seed movements (add test accounts, budgets, rules, debts and categories and delete or archive them
afterwards). Record each result with the iPhone model, iOS version, theme, language and text size. The design is in
[mobile-design.md](mobile-design.md) («Producto 24UX6E — Más destinos financieros en Forest»); the rule is in
[decision 005](decisions/005-forest-four-tabs-and-capture.md) («Enmienda 2026-10-01 — Producto 24UX6E»). This section
supersedes older items that expect a signed or green/amber debt total, «Pausado: …» as the paused or closed rule's
note, «Cuenta eliminada» in place of «Saldo registrado», a dimmed archived category, a day net on Movimientos
deshechos or «Pagos · ARS» in Recurrentes.

**For every destination below:** a 375 pt iPhone (SE / 13 mini) and a 393 pt one; AX text sizes (AX1–AX5) and the
default; light and dark; VoiceOver; Reduce Motion (bars jump, nothing new animates); Reduce Transparency; the last row
and the last button clear the home indicator and the dock where it shows, nothing under the notch.

- [ ] The Más footer reads «FinanzApp 0.1.0 (24UX6E)».

**Cuentas.**

- [ ] One account, then several in one currency, then accounts in two or three currencies: each currency is its own
  section; its header is the currency's name in ink (a heading, like a Movimientos day) with the recorded total
  beside it in secondary; currencies are never added together.
- [ ] A large positive balance (seven digits with cents, «$ 1.234.567,89») and a negative one: on a row at 375 pt the
  balance goes under the name instead of being drawn smaller; the negative keeps its minus in the alert tone; a
  negative section total too.
- [ ] A row shows the badge, the name and the balance only (no «Cuenta · ARS» line) and a chevron; it opens the
  detail.
- [ ] A long account name (40+ characters): two lines beside the balance, whole when stacked; never overlapping the
  chevron.
- [ ] At AX sizes, or with a long currency name and a long total, the section total goes under the name; nothing is
  shrunk or cut. VoiceOver stops once on the header and reads «Pesos argentinos, saldo registrado … pesos» as a
  heading (rotor «Encabezados» finds it).
- [ ] The account detail: the badge and «Saldo registrado · ARS» over the balance at 40 pt, then «Gastos este mes»
  (no sign, ink) and «Ingresos este mes» («+», green) flat on the canvas, no white card behind them; then the quick
  actions, Recurrentes and the movements. A negative balance in the alert tone with its minus.
- [ ] A deleted account's detail (open it from a movement's «Cuenta» row): a calm note at the top (trash glyph,
  «Cuenta eliminada», what still happens), the balance still labelled «Saldo registrado · ARS», the month facts and
  the movements; no Editar, no quick actions; legible in light and dark.
- [ ] Más → Cuentas → an account → Editar → «Eliminar cuenta» → confirm: you land on Cuentas in one step, the account
  gone; Atrás goes back to Más; the tab bar and the dock are there.
- [ ] Inicio → a recent movement → its «Cuenta» row → the account's detail → Editar → «Eliminar cuenta» → confirm
  (Cuentas is not in the stack on this path): Cuentas replaces the editor (the deleted account's readable detail may remain beneath it); Atrás and the tab bar still work,
  nothing is stuck and no blank screen appears.
- [ ] Tarjetas → a card without a balance due → Editar tarjeta → «Eliminar tarjeta» → confirm: you land on Tarjetas
  in one step, the card gone; Atrás and the tab bar intact. (Delete the test card.)

**Presupuestos.**

- [ ] No general budget, only category budgets: the general block is replaced by its compact «Agregar presupuesto
  general» button; the sublimit rows follow.
- [ ] A general budget plus several sublimits: the general block flat on the canvas (no white card): «Disponible» over
  the 40 pt amount, the 6 pt bar, «60 % utilizado» right under the bar, then Gastado | Límite.
- [ ] Calm (below 85 %): the amount and the bar in ink, the status line secondary. At 85–99 %: the amount still ink, the
  bar and «… · cerca del límite» in amber. At exactly 100 %: «Disponible» $ 0, the bar full, «100 % utilizado ·
  límite alcanzado» in amber. Exceeded: «Excedido» over the amount in the alert tone, the bar full and not
  overflowing, the alert glyph before «… · excedido».
- [ ] A sublimit row: the category tile in its own colour in every state (never repainted amber or red), the name, the
  percent on the right («91 %» like Inicio; the alert glyph once exceeded), a 4 pt bar, one quiet line («Quedan $ X de
  $ Y», «$ X por encima de $ Y», «Límite alcanzado · $ Y»); no chevron; tapping opens the budget's form as a modal.
- [ ] Very large amounts (a limit of $ 100.000.000,00, spending over 1000 %): the hero is whole, the percent reads with
  a thousands separator («1.235 %»), nothing is cut; at AX sizes the name and the percent stack.
- [ ] A long category name (custom, 40+ characters): two lines beside the percent; stacked at AX sizes, whole.
- [ ] A budget in another currency (USD while you mostly use ARS): the currency switch shows it; amounts in USD, never
  converted.
- [ ] A past month: «Este mes» appears beside the month state; it is easy to hit (44 pt reach) and returns to this
  month; at AX sizes the state and «Este mes» wrap onto two centred lines.
- [ ] A month with spending outside budgeted categories: «Además gastaste …» under the rows; VoiceOver reads the amount
  in words.
- [ ] Creating a second general budget for the same currency and month (or a second limit for the same category):
  an error under the form, the fields still editable; changing the category or the kind saves once. «Reintentar
  guardado» never appears for it.
- [ ] A malformed link on the development build (`finanzapp-dev://budgets?month=2026-13`, and
  `finanzapp-dev://new-budget?month=2026-13`): the screen and the form open on this month instead of failing.
- [ ] «Eliminar presupuesto» in the edit form is the red destructive button with the trash glyph; it asks first.
- [ ] VoiceOver: the general block is one element with the summary sentence; a sublimit row is one button with its
  sentence and the hint «Abre el presupuesto para editarlo».

**Recurrentes.**

- [ ] Expense and income rules, active and paused: the 30-day block per currency flat on the canvas: «Gastos · ARS» on
  its own full-width line, then «Ingresos» (only when something comes in, with «+» in green) and «Vencimientos».
- [ ] At 375 pt with a projection of ≥ $ 1.000.000,00 (seven digits with cents): «Gastos · ARS» is whole, never
  shrunk or cut; also at AX sizes.
- [ ] An expense due today or tomorrow reads «Hoy» / «Mañana» in amber; an income due today or tomorrow reads it in
  secondary, never amber; dates further out (in N days, a plain date) are secondary.
- [ ] A rule whose account was deleted reads «Cuenta eliminada» (a card's, «Tarjeta eliminada») where the day goes,
  calm, never amber and never «Revisar»; its swipe offers Eliminar only. VoiceOver ends the row's label with the same
  word.
- [ ] A rule under review (if you have one): «Revisar» in amber on its row; its detail shows the amber note right under
  the hero, then «Continuar desde hoy»; a failed action says so once under that button.
- [ ] A paused rule's detail: «Pausado» under the amount, then the note «No registra nada hasta que lo reanudes…» (no
  «Pausado:» prefix), then the facts, Registrados, and Reanudar / Eliminar at the end.
- [ ] A closed rule's detail: «Cuenta eliminada» / «Tarjeta eliminada» under the amount, the recovery note under it;
  Editar → choose a live account of the same currency → save → the detail now reads «Pausado» and offers Reanudar.
- [ ] A long merchant name and a large amount: the row stacks the amount under the name at AX sizes; nothing cut.
- [ ] Opened from an account's «Recurrentes» row: the rows leave the account's name out of their caption; the empty
  state says «Creá un gasto o ingreso recurrente para esta cuenta.»
- [ ] VoiceOver reads the detail's next date written out («1 de octubre de 2026»), «Hoy» as «Hoy».

**Deudas y cobros.**

- [ ] A debt I owe and one owed to me: neutral tiles (arrow up / arrow down, no amber or green tile); the totals flat
  on the canvas, both in ink; the amounts in ink.
- [ ] A partly settled debt: the outstanding amount is what remains; the state words unchanged.
- [ ] An overdue debt (either direction): only «Vencida · …» in the caption takes the alert tone, never «Debo» /
  «Me deben»; the detail's state line in the alert tone.
- [ ] A debt I owe due within three days: «Vence …» in amber on the row and the detail. One owed to me due within three
  days: secondary, never amber. A debt four or more days away: secondary.
- [ ] A closed debt (Cerrar from its swipe or detail): under Cerradas its row reads «Cerrada»; its detail has no state
  line and shows the note «Deuda cerrada» with «Reabrir deuda» named; «Vencimiento» appears among the facts if it had a
  date; never «Vencida» in red.
- [ ] The detail facts: no Tipo or Estado row; «Nota» when there is one; no empty grouped card when there is neither a
  note nor a date to show.
- [ ] A deleted debt leaves the list; its payments stay in Movimientos.
- [ ] A large amount and a long counterparty name: the row stacks at AX sizes; the detail's hero whole.
- [ ] Editar deuda shows «Tipo» and «Moneda» above the fields, not the name being edited; renaming leaves nothing stale.
- [ ] Dark mode: the neutral tiles on the grouped rows are visible; the amber and alert state words readable.
- [ ] VoiceOver: a row reads the day written out («Vence 1 de octubre de 2026») with the hint «Abre el detalle de la
  deuda»; the detail's state line the same.

**Categorías.**

- [ ] Active rows and Archivadas: the same contrast (archived rows are not dimmed); each archived row's caption starts
  with its kind («Gasto · …» / «Ingreso · …»); rows are 64 pt with hairlines and no chevron.
- [ ] A long custom name: two lines; at AX sizes the whole name wraps.
- [ ] VoiceOver on an archived row: «…, gasto, …, archivada» (or «ingreso»); the same preset archived in both kinds
  reads differently.
- [ ] Rename a custom category to an existing name (a preset or another category): an error under the field, the
  form still editable; a different name saves once; «Reintentar guardado» never appears for it.
- [ ] Open a historical category (one that came from old movements, never edited) and tap «Guardar cambios» without
  changing anything: it closes and the category keeps its glyph and colour everywhere (Movimientos, Reportes).
- [ ] An archived category's editor opens with the note «Archivada» (what it keeps, how to unarchive); the rename note
  appears under the name field while you type a new name.
- [ ] A link to a category that does not exist (or an edit modal for a deleted budget, debt, rule or account): the
  modal shows «No encontramos …» and a close button that works.

**Idioma, Región, Apariencia and Movimientos deshechos.**

- [ ] Más → Idioma, Región and Apariencia in light and in dark: the pinned card («Según el dispositivo»; «Sistema» in
  Apariencia) stands apart from the options card below, clean rounded corners on both, no background showing at the
  inner corners; the same at AX3.
- [ ] Choosing still saves and applies as before; the note stays under the list.
- [ ] Más → Movimientos deshechos with undone movements: the day headings have no «+$ …» / «−$ …» net; VoiceOver never
  reads «Neto del día»; the explanation sits above the list.
- [ ] With nothing undone: only «Nada para recuperar», no explanation line above it.

## Producto 24UX6D — Cards in Forest and final Home/Reports polish

**Not done in 24UX6D: no EAS build was made and the iPhone was not touched. Every item below is pending.**
Metro from this branch (`npm run start:dev-client -- --clear`) on the installed FinanzApp Dev build; JavaScript only
(Reportes Categorías and Día a día, Inicio's budget attention rows, Tarjetas, the card detail and the plan detail), no
native dependency, no card accounting, ledger, budget-rule, schema (13), backup (v13) or FX change, no tab animation.
Use your own data; never seed movements (add test cards for the deck and delete them afterwards). Record each result
with the iPhone model, iOS version, theme, language and text size. The design is in [mobile-design.md](mobile-design.md)
(«Producto 24UX6D — Tarjetas en Forest y pulido final de Inicio y Reportes»); the rule is in
[decision 005](decisions/005-forest-four-tabs-and-capture.md) («Enmienda 2026-10-01 — Producto 24UX6D»). This section
supersedes the 24UX6C2 items for the Reportes KPI, the quiet «Tocá una categoría» centre and the budget row's copy
(marked below), and 24T2's wording of the facts («Vence · Cierra · Disponible» in three columns) and of the plan
detail («12 cuotas · Sin interés», the «Registradas 3 de 12» row).

- [ ] The Más footer reads «FinanzApp 0.1.0 (24UX6D)». *(Superseded by 24UX6E: «FinanzApp 0.1.0 (24UX6E)».)*

**Reportes: Categorías.**

- [ ] No «Gastado · ARS» eyebrow, big amount, average per day or change line above the analysis; the order reads the
  currency chip and the month → Categorías | Día a día → the donut → «Por categoría» → Evolución → budgets, merchants,
  insights, income, net flow, the change row and Comparar.
- [ ] On a 393 pt iPhone (iPhone 14 Pro / 15 / 16) the donut is about 247 pt wide; on a 375 pt one (iPhone SE / 13
  mini) about 234 pt; it never touches the screen edges and its ring stays thin.
- [ ] With nothing chosen the centre reads «Total del período» (quiet) over the exact period total, the same figure as
  before this change (compare with Comparar or the category rows' sum); a seven-digit ARS total («$ 4.029.727,00») fits
  the hole whole, never cut or ellipsized.
- [ ] Tapping a slice: the centre shows its name, exact amount and «NN % del gasto» instead of the total; the slice
  thicker, the others dimmed; the matching row marked by more than colour (bold, outline, a light tint).
- [ ] Clearing: the same slice again, the hole, and a tap on the empty space left or right of the ring each bring the
  total back. A vertical scroll that starts beside the ring scrolls the list and does not clear; the segmented control,
  the month arrows, «Este mes» and the currency chip work as before with a category chosen.
- [ ] A month change (arrows, «Este mes», a bar), a currency or display-mode change and Categorías → Día a día →
  Categorías each clear the choice; back on Categorías the centre shows the total and no row is marked.
- [ ] Larger text (beyond 1.2×, and AX1–AX5), a 13-digit amount or a long custom category name: the readout (the total
  or the chosen category) moves under the donut, whole, and the hole stays clear; nothing overlaps the rows below.
- [ ] VoiceOver: the donut is one adjustable element; with nothing chosen its value is «Total del período, … pesos»;
  swiping up and down announces category, amount and percentage; the centre text is not a separate stop; the empty
  space beside the ring is not a VoiceOver element.
- [ ] Reduce Motion: the donut appears finished; the centre switches between the total and a category without motion;
  the choice still works.

**Reportes: Día a día and the moved pieces.**

- [ ] Día a día shows one compact line, «Total» and the exact amount (20 pt), no big hero and no average;
  with a long amount at 375 pt or at AX sizes the amount wraps under the label, whole. VoiceOver reads it once. An empty
  month shows only the empty card.
- [ ] The change against last month is a row of the lower facts between «Flujo neto» and «Comparar con el mes
  anterior» («Frente a los mismos días del mes anterior» or «Frente al mes anterior», «… % menos» / «… % más» / «Sin
  cambio», a trend glyph); VoiceOver says the percentage in words; Comparar still opens the full comparison.
- [ ] The «Qué cuenta este reporte» button sits beside the period line in every ready state (an empty month and the
  consolidated view included) and opens its explanation; with one currency the period line reads «Hasta hoy · ARS».

**Inicio: the budget progress row.**

Set a general budget for this month in Presupuestos (your own data; adjust the limit, never seed movements).

- [ ] Below 85 %: no row. At 85–99 %: one row before «Próximos compromisos»: «Presupuesto» and «91 %» (the percent in amber)
  on one line, a thin amber bar at that share, «Quedan $ …» quiet below, a chevron.
- [ ] At exactly 100 %: «100 %» still amber, the bar full, «Límite alcanzado»; never the alert tone yet.
- [ ] Over the limit: the alert glyph before «120 %» in the alert colour, the bar full and not overflowing, «$ … por
  encima»; the state is readable without colour (glyph and words).
- [ ] A general budget in another currency than Inicio's: «Presupuesto · USD» and coded amounts, never converted; a
  category-only budget never shows a row. *(The category half is superseded by the owner's refinement below: a category
  budget at 85 % or more now shows.)*
- [ ] Tapping opens Presupuestos on the budget's currency and month; back returns to Inicio.
- [ ] Spend or undo so the percent changes while Inicio is open: the bar moves (about 260 ms, no bounce); with Reduce
  Motion it jumps; nothing animates when Inicio first appears or a tab returns.
- [ ] VoiceOver: one button, «Presupuesto del mes, cerca del límite, 87 % usado, quedan … pesos» / «…, límite
  alcanzado, 100 % usado» / «Presupuesto del mes superado, 120 % usado, … pesos por encima», hint «Abre Presupuestos»;
  «%» read as «por ciento»; English «This month’s budget, close to the limit, 87% used, … left».
- [ ] Large text and AX sizes at 375 pt: the name and the percent stack, the detail wraps, nothing is cut; light and
  dark (the amber and alert percent and fill readable; the inset track visible in dark).

**Inicio: budget attention, general and category budgets (owner refinement, 2026-10-01).**

Set a general budget and category budgets for this month in Presupuestos (your own data; adjust the limits, never seed
movements; delete test budgets afterwards). The rule is in mobile-design.md («Inicio: atención de presupuestos
(refinamiento)»).

- [ ] General at 90 %, Supermercado at 97 %, Transporte at 50 %: two rows in **one** grouped surface with a hairline
  between them, «Presupuesto» first, then «Supermercado»; Transporte absent; no separator under the last row.
- [ ] General calm (below 85 %) and two category budgets in warning (for example Supermercado 95 %, Transporte 88 %):
  no general row; «Supermercado», then «Transporte».
- [ ] Five category budgets needing attention: exactly two rows (exceeded ones first, then the highest percents); the
  others only in Presupuestos.
- [ ] Exceeded first: a category at 110 % comes before a general budget at 95 %; the general exceeded plus a category
  exceeded plus several warnings → the general exceeded, then the category exceeded.
- [ ] A category row is titled by its name («Supermercado»; «Groceries» in English) in ink like «Presupuesto»; the
  percent and the bar in amber (warning) or the alert tone with the alert glyph (exceeded); no category colour
  anywhere in the row (title, glyph or bar).
- [ ] A USD category budget while Inicio shows ARS (consolidated): the row reads «Supermercado · USD» with coded USD
  amounts, never converted; tapping it opens Presupuestos in USD on this month; «Solo ARS» hides it.
- [ ] Each row opens Presupuestos on its own currency and month; back returns to Inicio.
- [ ] No budget needs attention (all calm): no budget surface at all, no header, no empty card.
- [ ] Long category names (a custom «Supermercado y almacén del barrio») with a large ARS amount at 375 pt and at AX
  sizes: the name wraps, the percent stacks under it, the detail wraps, nothing is cut, the hairline stays between the
  rows; light and dark.
- [ ] VoiceOver: each row is its own button: «Presupuesto de Supermercado, cerca del límite, 97 % usado, quedan …
  pesos», «Presupuesto de Supermercado superado, … % usado, … pesos por encima», «Presupuesto de Supermercado en USD,
  …» when the currency is named, the general still «Presupuesto del mes, …»; hint «Abre Presupuestos»; English
  «Groceries budget, close to the limit, …».

**Tarjetas.**

- [ ] One card: shown alone, in front, its snapshot below. Two and three cards: 50 pt strips above the front card; a
  strip tap brings its card forward with one light haptic; tapping the front card opens its detail; only the front
  card's figures show below.
- [ ] Four cards: still 50 pt strips. Five and six cards (test cards, deleted afterwards): every strip 44 pt, each still
  easy to hit, its first row (name and «•••• 4009») whole; choosing a strip near the top scrolls its card into view.
- [ ] Archive or delete the front card: another card comes to the front; the snapshot is never empty.
- [ ] Long names (for example «Visa Signature Banco Galicia Internacional»): two lines on the front face and on the
  detail face, one line on a strip, never a half-hidden second line; «•••• 4009» never shrinks; VoiceOver reads the
  whole name.
- [ ] The snapshot reads face → «Saldo pendiente» → Vence · Cierra (one row) → Disponible (its own row, with the
  usage bar) → Registrar compra / Pagar tarjeta → «Cuotas futuras» → Recientes with a quiet «Ver todos»; the balance
  and facts sit flat on the canvas, not in a white box; no white card nested inside another.
- [ ] A seven-digit ARS Disponible at 375 pt keeps the row size (not shrunk); «No calculado con cuotas» on one line and
  its explanation one tap away; «Sin límite cargado» without a limit; never a zero.
- [ ] Light and dark: the flat block, the usage bar and the grouped lists readable in both.
- [ ] Card detail: the same order and words, «de $ límite» under Disponible, Cuotas and Movimientos; an archived card
  shows the archive glyph, «Tarjeta archivada» and «Sigue recibiendo pagos y registrando sus cuotas. Para usarla de
  nuevo, reactivala en Editar tarjeta.», Pagar tarjeta while owed and no Registrar compra; a deleted card shows the
  trash glyph and its note and only reads.
- [ ] Plan detail: «12 cuotas sin interés» (or «con interés») under the price; the segmented bar (one segment per
  instalment up to 24, a continuous bar beyond) with recognised segments in ink, an undone one amber-outlined, future
  ones an empty tertiary outline and cancelled ones a dashed one, all visible on the canvas in light and dark; «3 de 12 registradas», «Próxima cuota · …» and the principal still to come while active;
  never «pagadas»; interest, fees and taxes rows only when real; the Calendario unchanged. VoiceOver reads the progress
  block once.
- [ ] Card movements: a purchase and a recorded instalment unsigned in ink; a card payment «Pago de tarjeta» in the
  transfer tone with no sign.
- [ ] Dynamic Type up to AX5 at 375 pt: the dates stack, the plan's amount moves under its count, nothing is cut;
  VoiceOver order follows the visual order; Reduce Motion: the cards jump into place and the values still fade.

**Regression.**

- [ ] The last content of Reportes, Tarjetas, the card detail and the plan detail clears the dock and the bottom safe
  area.
- [ ] Reduce Transparency: the dock turns solid pine; nothing in these screens depends on glass.
- [ ] 30 rapid tab switches without black screens.

## Producto 24UX6C2 — Home activity and Reports interaction polish

**Not done in 24UX6C2: no EAS build was made and the iPhone was not touched. Every item below is pending.**
Metro from this branch (`npm run start:dev-client -- --clear`) on the installed FinanzApp Dev build; JavaScript only
(Inicio's recent activity, its commitments window and general-budget attention row, the Reportes donut and the
category rows), no native dependency, no ledger, accounting, budget-rule,
schema (13), backup (v13), FX, card or instalment change, no tab animation, the Forest palette unchanged. Use your own
data; never seed movements. Record each result with the iPhone model, iOS version, theme, language and text size. The
design is in [mobile-design.md](mobile-design.md) («Producto 24UX6C2 — actividad de Inicio e interacción de
Reportes»); the rule is in [decision 005](decisions/005-forest-four-tabs-and-capture.md) («Enmienda 2026-10-01 —
Producto 24UX6C2»). This section supersedes the 24UX6A items «this month's expenses and incomes (no transfers)» in
«Actividad reciente», «at most two rules due within seven days» in «Próximos compromisos» (now a 30-day window) and
«no … budgets … on Inicio» (still no permanent budget card, but one contextual general-budget row when it needs
attention; *refined by 24UX6D: general and category budgets, at most two rows*).

- [ ] The Más footer reads «FinanzApp 0.1.0 (24UX6C2)». *(Superseded by 24UX6D: «FinanzApp 0.1.0 (24UX6D)».)*

**Inicio: recent activity.**

- [ ] «Actividad reciente» mixes this month's expenses, incomes and transfers, newest first (same day: the later
  recorded first), at most 4 under the commitments and 6 without them.
- [ ] A transfer appears once (not as an outflow and an inflow), its caption «Origen → Destino · fecha», its amount
  with no sign in the blue-teal transfer tone; an expense stays unsigned in ink and an income «+» in green.
- [ ] VoiceOver on a transfer row says «Transferencia, de X a Y, <amount>, <date>» (with a note: «Transferencia,
  <note>, de X a Y…»); tapping it opens the transfer detail, and back returns to Inicio.
- [ ] Record a transfer between two cash accounts: Gastado does not change, and Disponible does not change either
  (money moved between two accounts it counts).
- [ ] A debt collection or a card payment in the list does not make the expense rows name their account when every
  real account shown is the same.
- [ ] An undone transfer does not appear; with one currency of several shown alone, a transfer in another currency
  does not appear.
- [ ] The amount size and alignment, «Total · ARS», the month label and «Ver todos» → Movimientos are unchanged.
- [ ] «Próximos compromisos» is still conditional, now over a rolling 30-day window: only active recurring expense
  rules due from today through today + 30 days, both ends inclusive (on 2026-10-01: 2026-10-01 … 2026-10-31), soonest
  first, at most two, absent when none falls in the window; a recurring income, a paused or deleted rule, a card
  statement, an instalment or a debt payment never appears there; «Ver todos» → Recurrentes.
- [ ] Window boundary: a rule whose next date is today + 30 days appears (when it is among the two soonest); one on
  today + 31 does not; the same rule counts in Recurrentes' «próximos 30 días» figure.

**Inicio: the general-budget attention row.**

Set a general budget for this month in Presupuestos (your own data; adjust the limit, never seed movements) and watch
Inicio as the month's spending crosses each threshold.

- [ ] Below 85 % of the general budget: no budget row and no budget card on Inicio.
- [ ] At 85 %: one row appears after the financial field and before «Próximos compromisos» and «Actividad reciente»,
  amber: the speedometer tile, «Usaste 85 % del presupuesto del mes» and «Quedan $ … de $ …» in amber; a chevron.
  *(Copy and anatomy superseded by 24UX6D's progress row: «Presupuesto», «85 %», a bar, «Quedan $ …»; the threshold and
  placement stand.)*
- [ ] At exactly 100 %: still amber (warning), «Usaste 100 % …» and what is left ($ 0); never the alert tone yet.
  *(Copy superseded by 24UX6D: «Límite alcanzado».)*
- [ ] Over the limit: the alert tone (the alert-circle tile in the expense colour), «Superaste el presupuesto del mes»
  and «$ … por encima de $ …» with the amount over in the alert colour. *(Copy and anatomy superseded by 24UX6D: the
  alert glyph before «120 %», a full bar and «$ … por encima».)*
- [ ] Category-only budgets (no general budget), even exceeded: never a row on Inicio. *(Superseded by the 24UX6D
  refinement: a category budget in warning or exceeded now shows, at most two rows; see Producto 24UX6D.)*
- [ ] Tapping the row opens Presupuestos on the budget's currency and month; back returns to Inicio.
- [ ] Consolidated view with the general budget in another currency than the display currency: the row names it
  («… del mes en USD», amounts with their code) and its amounts are that currency's, never converted; in a single
  currency view only that currency's budget can show.
- [ ] Consolidated view with a calm general budget (or only a category sublimit) in the display currency and an
  exceeded general budget in another held currency: the row shows the exceeded one, naming its currency; «Solo …» the
  calm currency shows nothing. *(Since the 24UX6D refinement a category budget needing attention also shows; see
  Producto 24UX6D.)*
- [ ] Undo or edit expenses (or raise the limit) until the month falls below 85 %: the row disappears.
- [ ] VoiceOver reads the row once: the spoken percent or «Superaste…», then the spoken amounts, and the hint «Abre
  Presupuestos»; English: «You used 87% of this month’s budget», «… left of …», «You went over this month’s budget»,
  «… over …», «Opens Budgets». *(Wording superseded by 24UX6D: «Presupuesto del mes, cerca del límite, 87 % usado,
  quedan …».)*
- [ ] Large text and AX sizes: the title and detail wrap, nothing is cut; light and dark both readable.

**Reportes: the donut.**

- [ ] The top total («GASTADO · ARS», the amount and its line) shows in both Categorías and Día a día. *(Superseded by 24UX6D: see «Producto 24UX6D» above.)*
- [ ] With nothing chosen the donut's centre reads only the quiet «Tocá una categoría» («Tap a category»); it never
  repeats the month's total. *(Superseded by 24UX6D: with nothing chosen the centre shows «Total del período» and the
  exact total.)*
- [ ] Tapping a slice: the centre shows the category's name, its exact amount and «NN % del gasto» (the same
  percentage as its row); that slice is drawn thicker and the others dimmed, at once, without a new animation; the
  matching row is marked (bold name, an outline and a light tint in the category hue).
- [ ] Tapping the chosen slice again, or the hole, clears the choice; tapping just beside the ring or in the thin gap
  between slices behaves sensibly (the gap picks the next slice).
- [ ] VoiceOver: the donut is announced as adjustable («Gasto por categoría», its slices, «Ninguna categoría
  elegida» *(24UX6D: «Total del período, …»)*); swiping up and down steps through the categories, announcing name, amount and percentage, and past either
  end returns to none (down from none starts at the last). The centre's text is not a separate VoiceOver stop; the
  Actions rotor shows «Categoría siguiente» / «Categoría anterior»; a double tap does not clear the choice.
- [ ] Larger text (beyond the default, and AX sizes), a very long amount or a long custom category name: the chosen
  readout moves under the donut, whole, and the hole stays clear; neither the amount nor the name is cut.
- [ ] Changing the month (arrows, «Este mes», a bar), the display currency or mode (also from Inicio's chip) resets the
  choice, and going back does not bring it back; the category rows still open their detail.
- [ ] A Japanese or emoji category name (e.g. «食料品・日用品», «Mascotas 🐶») with a large amount stacks like a long
  Latin name.
- [ ] Reduce Motion: the donut appears finished and the choice still works; the first sweep and the month crossfade
  are unchanged with it off.

**Category rows.**

- [ ] A long name (for example «Supermercado») with a large amount at 375 pt: the row stacks cleanly (the name on its
  own lines, the amount and its percentage together under it), no stray last letter and no shrunken amount; short names
  stay on one line.
- [ ] The same at the accessibility text sizes (AX1–AX5): every row stacks; in Reportes and in a category's spending
  rows.

**Regression.**

- [ ] Month navigation, the six-month bars and «Este mes» still work; Día a día unchanged.
- [ ] 30 rapid tab switches without black screens.

## Producto 24UX6C — Movement presentation, Home polish and Más

**Not done in 24UX6C: no EAS build was made and the iPhone was not touched. Every item below is pending.**
Metro from this branch (`npm run start:dev-client -- --clear`) on the installed FinanzApp Dev build; JavaScript only
(presentation of movements, Movimientos, Inicio, the capture hub, the Assistant screen and Más), no native dependency,
no accounting, ledger-sign, stored-amount, schema (13), backup (v13), FX, card, instalment or recurring change, and no
tab animation. Use your own data; never seed movements. Record each result with the iPhone model, iOS version, theme,
language and text size. The design is in [mobile-design.md](mobile-design.md) («Producto 24UX6C — presentación de
movimientos, Inicio y Más»); the rule is in [decision 005](decisions/005-forest-four-tabs-and-capture.md) («Enmienda
2026-10-01 — Producto 24UX6C»). This section supersedes the 24UX6A items about the line under the Home number, the
Movimientos header «+» and the neutral hub tiles.

- [ ] The Más footer reads «FinanzApp 0.1.0 (24UX6C)».

**Movement rows.**

- [ ] Movimientos in light and dark: an expense shows its amount with no minus, in ink; an income shows «+» in the
  income green; a transfer shows its amount with no sign in the blue-teal transfer tone (clearly apart from the pine
  brand and from grey secondary text).
- [ ] Day headers read as headings in ink (subhead, semibold); each day's net stays secondary with its «−» / «+».
- [ ] An account, a card, a debt and Recurrentes show their rows with the same rule, while a negative balance keeps its
  minus. A transfer row inside an account no longer carries ±.
- [ ] The movement detail hero (expense, income, transfer) and the recurring rule detail hero: the stored amount, «+»
  only for an income.

**Search, filters and the header.**

- [ ] Movimientos has no «+» in its header; the dock «+» records from it as from every tab.
- [ ] The search pill: 44 pt, a hairline edge, the magnifier, the placeholder «Comercio, categoría o cuenta» (whole
  at 375 pt); typing filters as before, the native clear button empties it; VoiceOver reads «Buscar movimientos»
  («Search transactions» in English).
- [ ] The kind filter and the count line (secondary). With VoiceOver, changing the filter announces the new count at
  once, and typing announces it after a short pause (iOS has no live regions, so the screen announces it); switching tabs
  or opening a row during that pause announces nothing over the next screen; a search with no match shows
  the empty state with its brand-tinted glyph tile and the clear action.
- [ ] Undo / Recover and Movimientos deshechos behave as before.

**Inicio.**

- [ ] Gastado and Disponible show no line under the number (no «Hasta hoy · … por día», «Sin gastos este mes» or
  «Saldo registrado · N cuentas»).
- [ ] With one currency the ⓘ sits beside the number: Disponible always offers its explanation; Gastado only when a
  conversion is shown. With two currencies or more the chip and its help stay in the scope row; the chip label reads
  quieter (weight 500) and still has a 44 pt target.
- [ ] A $0 total stays dimmed but legible; the empty state's glyph tile is visible in both themes.

**Capture hub and Assistant.**

- [ ] The hub keeps Asistente, Gasto, Ingreso, Transferencia; the row tiles are tinted but calm (expense grey with an
  ink glyph, income soft green, transfer soft blue-teal); each still opens its screen once.
- [ ] The Assistant shows no permanent «No conectado en esta versión…» caption and no microphone in the composer;
  sending a message adds the in-thread note «El Asistente todavía no está conectado en esta versión. Tu mensaje quedó
  escrito para cuando lo esté.» and keeps the words; the empty conversation's glyph (accent circle, sparkles) is
  visible in light and dark; the suggestion chips still work.

**Más.**

- [ ] Two groups, Finanzas and App y datos, each under a small caps label; the labels are reachable with the VoiceOver
  rotor (Headings); the spacing between groups reads even.
- [ ] Every row in the same order opens its screen: Cuentas, Tarjetas, Presupuestos, Recurrentes, Deudas y cobros,
  Categorías; Copia de seguridad, Movimientos deshechos, Idioma, Región (when shown), Apariencia. App y datos rows lead
  with neutral glyph tiles; there is no «Ajustes» row.

**Accessibility and stability.**

- [ ] VoiceOver reads each row as Gasto / Ingreso / Transferencia with its amount (a transfer titled by a note starts
  with «Transferencia» and does not repeat the note; in a card or debt context a transfer reads as «Pago de tarjeta»,
  «Pago» or «Cobro», as before). A Recurrentes row says «gasto» or «ingreso» right after the merchant. Check in Spanish and English.
- [ ] Dynamic Type at the accessibility sizes on a 375 pt iPhone (or Zoomed display): rows, day headers, the search
  pill, the Home number with its ⓘ, the Más labels; nothing clips or overlaps.
- [ ] Reduce Motion on and off: nothing new moves.
- [ ] Switch tabs 30 times quickly: no black screen, no blank frame, no cross-fade.

Record: date, iPhone model, iOS version, build, language, and every result above (a failure with a screenshot of your
own test data only, never of real financial data).

## Producto 24UX6B — Reportes hierarchy

**Not done in 24UX6B: no EAS build was made and the iPhone was not touched. Every item below is pending.**
Metro from this branch (`npm run start:dev-client -- --clear`) on the installed FinanzApp Dev build; JavaScript only
(Reportes, the idle month-bar colour and its copy), no native dependency, no schema, backup, route or navigation
change. Use your own data; never seed movements. Record each result with the iPhone model, iOS version, theme and text
size. The design is in [mobile-design.md](mobile-design.md) («Producto 24UX6B — jerarquía de Reportes»).

- [ ] The Más footer reads «FinanzApp 0.1.0 (24UX6B)».

**Reading order.**

- [ ] Light and dark, top to bottom: the display-currency chip (only with more than one currency held), the month with
  its arrows and «Este mes»; «GASTADO · ARS» with its ⓘ, the amount, one line «… por día · …»; the Categorías | Día a
  día control; the donut; «Por categoría» over the category rows; then «Evolución» («Tocá un mes para verlo») with
  «Últimos seis meses»; then budgets, «Dónde más gastaste», «Para tener en cuenta», income and net flow, «Comparar con
  el mes anterior». The six-month bars are no longer the first chart.
- [ ] Switch Categorías ↔ Día a día: only the analysis block changes (Día a día: no donut, «Por día» with «Solo días
  con gastos registrados.» over the day rows); «Evolución» and the details stay below, in the same order. A category
  row opens its detail; a day row opens its day.
- [ ] Scroll down to «Evolución» and tap a past month's bar: that month opens and the list scrolls back to the top
  (its title, total and analysis in view; with Reduce Motion the jump is immediate). «Este mes» or the arrows lead
  forward again.

**History rule.**

- [ ] A ledger with spending only in the current month: «Evolución» shows the quiet card «Con más meses de gastos
  registrados vas a ver la evolución acá.» instead of a lone bar. The same card for a past month that is the only one
  of its own six months with spending.
- [ ] A month where none of the six months has spending, or a currency with a missing rate: no bars and no note.

**Empty states.**

- [ ] An empty month (an earlier month with nothing recorded, or a currency with nothing this month): the zero total
  in its usual inks, no orphan «Por categoría» / «Por día» heading, and one card. Categorías: «Sin gastos en este
  período» / «Los gastos que registres en esta moneda aparecen acá, por categoría.» with the pie glyph. Día a día: the
  same title with «Cada día con gastos en esta moneda aparece acá, con su total.» with the calendar glyph. It reads as
  intentional, not broken.

**Accessibility.**

- [ ] VoiceOver, swiping from the top: chip, month and arrows, the total, the summary line read once and in words
  (the average as spoken money, the change as a spoken percent; no currency symbol or grouped digits spelled out), the
  segmented control, the donut, the «Por categoría» heading and rows, then Evolución and its bars, budgets, merchants,
  insights, income/net, Comparar. The headings are reachable with the rotor (Headings). Check in Spanish and English.
- [ ] Dynamic Type from the default to the largest accessibility size on a 375 pt iPhone (or Zoomed display): the
  headings, the summary line (wraps, never clips), the rows (stack without overlapping) and the Evolución card; the
  last section scrolls clear of the dock.

**Colour and motion.**

- [ ] The unselected month bars are clearly visible in light and dark (the shown month stays the pine bar; the month in
  progress stays outlined, also when it is not the shown one).
- [ ] No red on ordinary spending (the total, the rows, the bars); the brick tone appears only for an exceeded budget
  and its insight.
- [ ] Reduce Motion off: the donut sweeps clockwise when it appears (opening Reportes, and back on Categorías after
  Día a día), a month change is one fade, the bars glide between months, a bar tap scrolls up. Reduce Motion on: the donut appears complete, the bars jump, only the fade stays. Nothing
  new moves.
- [ ] Switch tabs into Reportes 30 times quickly (from Inicio, Movimientos and Más): no black screen, no blank frame,
  no cross-fade.

Record: date, iPhone model, iOS version, build, language, and every result above (a failure with a screenshot of your
own test data only, never of real financial data).

## Producto 24UX6A — Forest foundation, four-tab shell, capture hub and Home

**Not done in 24UX6A: no EAS build was made and the iPhone was not touched. Every item below is pending.**
This section replaces the one written for the first iteration of this PR (five tabs with «Inicio, pestaña, 1 de 5»,
the «＋ Registrar» capsule under the number, the cobalt selected tab): those checks no longer describe the code
([decision 005](decisions/005-forest-four-tabs-and-capture.md), 2026-09-30). Metro from this branch
(`npm run start:dev-client -- --clear`) on the installed FinanzApp Dev build; JavaScript only, no native dependency
added and no schema change (the ledger stays at schema 13, backups at v13; the Appearance choice lives outside both;
the Assistant's conversation is memory only). Use your own data; never seed movements. Record each result with the
iPhone model, iOS version, theme, material (glass or Reducir transparencia) and text size.

- [ ] The Más footer reads «FinanzApp 0.1.0 (24UX6A)».

**Shell — four tabs and the «+».**

- [ ] A floating pine dock above the home indicator, clear of it, with four tabs (Inicio, Movimientos, Reportes, Más)
  shown as icons only (no visible labels); the current one has a filled glyph inside a lighter pine capsule. The
  round «+» sits beside the dock, outside it. No Asistente tab.
- [ ] VoiceOver: «Inicio, pestaña, 1 de 4», «Movimientos, pestaña, 2 de 4», «Reportes, pestaña, 3 de 4», «Más,
  pestaña, 4 de 4», with «Seleccionado» on the current one. The «+» reads «Registrar, botón» with the hint «Abre las
  opciones para registrar»: never a tab, never selected, and not counted in «de 4».
- [ ] At the accessibility text sizes, a long press on each tab shows its name large (Large Content Viewer).
- [ ] Switch tabs 30–40 times quickly (including Más and Reportes, and back to Inicio): no black screen, no blank frame,
  no cross-fade (the switch is instant).
- [ ] Tapping the tab already selected does nothing harmful (no reload, no jump, no blank screen). Movimientos keeps its
  header «+» to Registrar gasto.
- [ ] Glass (iOS 26, Reducir transparencia off) and solid pine (on), in light and dark: both read as designed; the
  «+» keeps its mint fill with the dark glyph clearly legible in both. Glass appears only on the dock pill, an account
  detail's movement pills and the Assistant composer; the «+» and the hub card stay solid.
- [ ] On a 375 pt iPhone (or Zoomed display): the four icons and the «+» fit with even spacing; nothing overlaps; the
  last row of a long list (Movimientos, Reportes, Más) scrolls clear of the dock.
- [ ] Landscape inset: the app is portrait-only, so confirm it does not rotate; the left/right inset term of the dock
  geometry is covered by tests only.

**Hub — Registrar.**

- [ ] Tap «+» on every tab (Inicio, Movimientos, Reportes, Más): one light haptic, the card «Registrar» rises a little
  above the dock with a fade, the scrim darkens behind it, and a «×» («Cerrar») appears exactly where the «+» was.
  Order: the Asistente tile first (pine, «Decilo con tus palabras o preguntá lo que quieras»), then Gasto, Ingreso,
  Transferencia with their sublines. No microphone.
- [ ] Each closes it and opens nothing: «×», a tap on the scrim, the VoiceOver escape gesture (two-finger Z). (The
  Android back button closes it too; not checkable on iPhone.)
- [ ] First choice holds: tap a row and, while the card is leaving, tap another row, the scrim or the «×»: only the first
  choice opens, once.
- [ ] Each row opens its form after the card has gone: Gasto → Registrar gasto, Ingreso → Registrar ingreso (in the
  shown currency when an account holds it), Transferencia → Transferir, Asistente → the Assistant screen. Nothing is
  saved from the hub.
- [ ] Reduce Motion: the card and the «×» fade in place without rising. A long press on «+» does nothing extra.
- [ ] VoiceOver inside the hub: focus stays in it; title, the Asistente tile, the three rows and «Cerrar» are each read
  once.
- [ ] AX5 (the largest accessibility text size) on a 375 pt iPhone (or Zoomed display): the hub card stays below the
  status bar and above the dock, and its title and four options scroll inside the card (no bounce) so every option
  can be reached; «Cerrar» stays where the «+» is.

**Assistant — a stack screen.**

- [ ] From the hub, the Assistant pushes over the tabs with its title and the native back button; back (button or edge
  swipe) returns to the tab where the «+» was tapped, with the dock as it was.
- [ ] Write a message and get an answer, go back, open the Assistant again from the hub: the conversation is still
  there and scrolls to its last exchange once. An answer still streaming when you leave lands in the conversation.
- [ ] The hub shows «Continuar: «…»» with your own last words only after you wrote something in this session; never
  before. «Nuevo chat» (in the header once there are messages) clears the conversation, and the chip disappears.
- [ ] Force-quit and reopen: the conversation is gone and the hub shows no «Continuar».
- [ ] The composer as a stack screen: with the keyboard down it rests above the home indicator with no empty strip
  (no dock below it); tapping the field raises it to the keyboard's top edge exactly; interactive dismiss follows the
  drag.
- [ ] Tapping «Ver movimientos» in an Assistant answer returns to the existing tabs on Movimientos (the Assistant is
  popped, the Movimientos tab selected): one dock, and back does not reveal a second tab set. The dock is usable from
  there.
- [ ] A proposed movement is written only after Confirmar; nothing is written on its own.

**Home — the financial field.**

- [ ] The pine field reaches under the status bar in light and dark, with light status-bar content over it. In light
  mode, scroll past the field: the status bar returns to dark text; it is also dark text on every other screen
  (Movimientos, Más, a pushed detail) and back to light when Inicio is focused at the top.
- [ ] The month label (the current month) is plain text: not tappable, no chevron. The wallet button opens Cuentas.
- [ ] With one currency held: no scope row (the ⓘ help sits beside the subline). With two or more: the display
  currency chip and ⓘ on their own row; the chip still opens its sheet and the number changes behind it.
- [ ] Gastado: «Hasta hoy · $ … por día», or «Sin gastos este mes» with nothing spent (the number then in the softer
  ink). Disponible: «Saldo registrado · N cuentas», never a per-day figure. Gastado | Disponible switches only the
  number and its line.
- [ ] *(Window superseded by 24UX6C2: 30 days, today through today + 30 inclusive.)* «Próximos compromisos»: at most two rules due within seven days, «Ver todos» → Recurrentes; with none, the
  section is absent.
- [ ] *(Superseded by 24UX6C2: transfers are part of «Actividad reciente», once each.)* «Actividad reciente»: this month's expenses and incomes (no transfers), newest first, at most 4 with
  commitments and 6 without; «Ver todos» → the Movimientos tab.
- [ ] Empty states: accounts but nothing this month and nothing due → «Todavía no hay movimientos este mes» /
  «Registrá un gasto con el botón Registrar (+) o contáselo al Asistente.» with no button. With two or more
  currencies held and one shown alone («Solo X») with nothing this month in it, the title names the currency:
  «Todavía no hay movimientos en X este mes». No account → the empty state with
  «Empezar» → Nueva cuenta. No «＋ Registrar», no insight line, no rankings, budgets, charts or Assistant banner on
  Inicio. *(Refined by 24UX6C2: still no permanent budget card, but one contextual general-budget row when it needs
  attention; refined again by 24UX6D: general and category budgets, at most two rows.)*
- [ ] The 46 pt number with a 9-digit amount (e.g. $ 123.456.789) on a 375 pt iPhone: one line, shrinks, never clips;
  a missing rate shows the per-currency parts instead.
- [ ] Dynamic Type from the default to the largest accessibility size: the field, the subline, the Gastado |
  Disponible control and the rows grow and wrap without clipping or overlapping the dock.

**Forest.**

- [ ] Light and dark (OLED black in dark): the field, the dock and the «+» read with enough contrast; pine, never
  teal, cyan, emerald or blue. Ordinary spending is not drawn red; the brick tone appears only for over-limit,
  overdue or destructive states.
- [ ] Category colours are unchanged versus master: the same category keeps the same tile colour in Movimientos,
  Reportes and a movement's detail.

**Appearance.**

- [ ] Más → App y datos → Apariencia: Sistema (with «ahora claro/oscuro»), Claro, Oscuro still apply at once, the
  keyboard, an alert and the date wheel included. Force-quit and reopen on Oscuro with the iPhone in light: no light
  flash after the launch screen. Back to Sistema: the app follows the iPhone again.

Record: date, iPhone model, iOS version, build, language, and every result above (a failure with a screenshot of your
own test data only, never of real financial data).

## Producto 24T2 — installment purchase and complete Cards experience

**Result (2026-09-29): completed by the owner on an iPhone 14 Pro with a fresh development build, after the schema 13
upgrade of their data. PR #69 merged (merge commit 8951f6c).**

The owner reported on 2026-09-29 that this section passed; no per-item results were recorded here, so the items
below stay unticked as written.

**Before the merge (2026-09-28): no EAS build had been made and the iPhone had not been touched.** Metro from this branch
(`npm run start:dev-client -- --clear`) on the installed FinanzApp Dev build; JavaScript only, no native change.
**The ledger moves to schema 13 (one new empty table for exact statement dates) and an older build refuses the file
unchanged: export a backup first** (Más → Copia de seguridad). Use your own small test data (one test card, two or
three purchases); never seed movements, and delete the test plans afterwards (a plan that recorded nothing is deleted
from its detail).

**Brief test (≈15 minutes).**

1. **Upgrade.** Open the app over your data: Inicio, Movimientos, Tarjetas, Recurrentes and Reportes show the same
   figures as before; force-quit and reopen: nothing migrates twice.
   - [ ] The Más footer reads «FinanzApp 0.1.0 (24T2)».
2. **Cycle dates.** On a card with closing 28 and due 5 (or your real days), Tarjetas shows «Vence» with the due date of
   the statement that already closed while it is still ahead, and «Cierra» with the next closing (with closing 28 and
   due 5 on 1 October: Vence 5 oct, Cierra 28 oct).
   - [ ] Editar tarjeta: «Próximo cierre» and «Vencimiento» open the full calendar (day, month, year); a due date on or
     before the closing is refused with its sentence; «Vence el resumen del 28 sep» corrects only that due date;
     «Usar estos días todos los meses» off corrects this statement only (the note says so), on repeats the days; a
     closing moved 20 days or more leaves the switch off and free (one-off unless you turn it on). Save and reopen: the dates
     are the ones saved; movements, earlier statements and existing plans did not move; the month after the new
     closing has its statement (none skipped, none duplicated).
   - [ ] Nueva tarjeta: the two dates first, the line «Los meses siguientes: cierre el día … y vencimiento el día …»,
     then the rest of the form as before.
3. **Purchase in cuotas.** Tarjetas → Registrar compra (an active card): «Pago» under the date with Una vez / En cuotas.
   En cuotas: 3 · 6 · 12 · 18 · Otra (Otra takes 2 to 120), «12 cuotas de $ …» (with «aprox.» when the price does not
   divide evenly), «Primera cuota» with the two closing dates and «Cierra el … y vence el …», «Con interés» off.
   Guardar en cuotas: the form closes; no expense appears in Movimientos today; the card shows «Cuotas futuras».
   - [ ] Con interés on: «Total financiado» below the price is refused with its sentence; equal to the price reads
     «Interés total: $ 0»; above it, the difference. After saving: the plan detail shows Total financiado, Interés total
     and Principal futuro / Interés futuro; Tarjetas shows «Cuotas futuras» with «+ interés $ …» beside it.
   - [ ] Before any purchase «Con interés», the category picker and Más → Categorías show no «Intereses» (and never a
     category you did not create or record); right after saving one, «Intereses» is listed with its icon and colour.
   - [ ] A purchase dated before the last closing (a late one): the note says the first instalment is recorded at once;
     after the save, Movimientos holds «Cuota de tarjeta» for it and the card's balance rose by exactly that share.
   - [ ] Ingreso, another account, or an archived card: no «Pago» section; back on the card, the choices are as left.
   - [ ] Double-tap Guardar: one plan only (a forced write failure is covered by the SQLite tests).
4. **Tarjetas deck.** With two or more cards: the others are strips above the selected one; tapping a strip brings it
   to the front with one light haptic and the snapshot below changes without jumping (values fade, a block that only one
   card has fades and what is below slides); tapping the front card opens its detail; the back swipe from the edge
   still works everywhere. One card is shown alone, not stacked. With more than twelve cards (test cards, deleted
   afterwards), a strip near the top brings its card into view. Archived cards are listed under «Archivadas» at the end
   and open their detail (Pagar tarjeta still there while owed).
   - [ ] «Disponible» of a card with a limit and a pending plan reads «No calculado con cuotas»; tapping it explains
     why; without a limit, «Sin límite cargado»; never a zero.
5. **Card detail and plan.** The face, «Saldo pendiente», Vence · Cierra · Disponible (with «de $ límite»), Registrar
   compra (active cards only) and Pagar tarjeta, «Cuotas» with one row per plan («12 cuotas · 3/12 registradas», the
   amount «restantes», «Próxima cuota · 28 oct»), Movimientos with «Este ciclo, desde …». A plan opens its detail:
   price, «12 cuotas · Sin interés», Registradas «3 de 12», Ya registrado, Cuotas futuras, Restante, and «Calendario»
   with Registrada / Próxima / Futura (Deshecha after an undo). Never «pagadas», never «Deuda».
   - [ ] A recorded instalment opens «Cuota de tarjeta» with the row «Cuota · 3 de 12» that opens its plan; Editar
     offers only the merchant and the category (amount, date and card as facts); Deshacer says it is not recorded again
     by itself, and its plan row reads Deshecha; Recuperar brings it back. On a plan with interest, undoing only the
     interest share says only that part is undone, and the row reads «Registrada en parte».
6. **Accessibility.** VoiceOver on the deck reads each card once, top to bottom, the positions in that order and the
   front card last and selected («Tarjeta Visa Gold, Galicia, termina en 4009, pesos, Tarjeta 3 de 3, seleccionado»),
   with the hints «Selecciona esta tarjeta» / «Abre el detalle de la tarjeta»; the purchase section reads the count,
   the per-instalment line with the amount in words, each «Primera cuota» segment as its whole statement and the switch
   with its reason. The largest Dynamic Type: the strips grow up to their cap and name and last four never overlap; the
   plan, schedule and future rows stack without cutting a word or a figure. Reduce Motion: the cards jump into place
   and the snapshot's values still fade (not an instant swap). Light and dark; both languages.

Record: date, iPhone model, iOS version, build, language, and every result above (a failure with a screenshot of your
own test data only, never of real financial data).

## Producto 24T1 — the instalment engine (nothing visible; a regression spot-check)

**Not done in 24T1: no EAS build was made and the iPhone was not touched.** Metro from this branch on the installed
FinanzApp Dev build; JavaScript only. **The ledger moves to schema 12 (two new empty tables for instalment plans) and an
older build refuses the file unchanged: keep a backup first** (Más → Copia de seguridad). No screen creates a plan yet.

- [ ] Open the app over your data: Inicio, Movimientos, Tarjetas, Recurrentes and Reportes show the same figures as
  before; force-quit and reopen: nothing migrates twice, nothing changed.
- [ ] Record a card purchase and a card payment as before: one expense, the balance due up then down, no cash account
  touched by the purchase (decision 003, rules 2 and 3).
- [ ] Más → Copia de seguridad → export: the file is still the version it was (v8–v11); import it back: «identical».
- [ ] Archive a card (Tarjetas → card → Editar → Archivar): Nuevo gasto, Nuevo recurrente and the Assistant's confirm
  no longer take it (the forms do not offer it; a confirm is refused with «Esta tarjeta está archivada…»); an existing
  purchase on it still opens and is corrected in place; Pagar tarjeta still accepts a payment to it; a recurring rule
  already on it keeps its own dates. Reactivate it: it is offered again.
- [ ] With Airplane mode or a full disk you cannot easily force a write failure on the iPhone; the banner «No pudimos
  registrar las cuotas vencidas…» with «Verificar de nuevo» is covered by the real-SQLite tests and is checked on the
  device in 24T2, once a plan can be created.

The device gates of instalments come with their screens: 24T2 (the purchase form, the five figures, the commitments on
the card) and 24T3 (refunds, payoff, the deletion block, Tarjetas and Deudas on the iPhone).

## Producto 25B3 — detail hierarchy polish

**Not done in 25B3: no EAS build was made and the iPhone was not touched.** Metro from this branch
(`npm run start:dev-client -- --clear`) on the installed FinanzApp Dev build; JavaScript only, no native change, no
schema change, no data change. Use your own small test data; never seed movements.

**Brief test (≈6 minutes).**

1. **Account detail.** Más → Cuentas → an account: the hero «Saldo registrado» shows the same number as before
   this branch; under the quick actions the group holds only Recurrentes (no «Saldo inicial»); Gastos / Ingresos del
   mes, the three actions and the movements are unchanged. A deleted account's detail (25B2) shows its balance and
   history with no group at all. Editar cuenta and Nueva cuenta still show the opening balance where they did.
   - [ ] The Más footer reads «FinanzApp 0.1.0 (25B3)».
2. **Recurring detail.** Inicio → Próximos compromisos → a row: the rule's detail opens (pushed, back swipe works),
   not the edit form: mark, «Gasto recurrente · ARS», the signed amount, «Activo», then Próxima fecha, Frecuencia,
   Categoría, Cuenta (tap: the account's detail), «Registrados» (each recorded movement opens itself), Pausar
   recurrente and Eliminar recurrente (red). Más → Recurrentes → a row opens the same detail; a recorded movement's
   «Recurrente» row too. Editar (pencil, header) opens the modal form, which no longer lists Registrados or the
   lifecycle buttons; Guardar cambios returns to the detail with the change visible.
   - [ ] Pausar recurrente: the state under the amount reads «Pausado», Próxima fecha disappears, the note explains,
     Reanudar recurrente appears; the screen stays. Reanudar: «Activo» again with the next date on its own day.
   - [ ] Eliminar recurrente: the same «¿Eliminar «…»?» alert as the row's swipe; Cancelar changes nothing; Eliminar
     goes back to Recurrentes and the rule is gone; its recorded movements stay in Movimientos.
   - [ ] A rule whose account was deleted (25B2): the detail offers Eliminar as its only lifecycle button and the note names
     the way out. Editar: the account field offers the deleted row and the live accounts/cards of the same currency only
     (no other currency, no deleted card, no debt); pick a live one and, if the next date is past, a date from today on
     (Guardar refuses a past date); Guardar: back on the detail, still Pausado, Reanudar
     recurrente now offered; Reanudar: Activo with the next date today or later, no movement recorded for the paused
     period. Cancel the edit instead: still Eliminar only.
   - [ ] A rule with a next date already past (force-quit the app across a due day with the rule paused, resume it on
     its due day, or set the iPhone date forward): «Revisar» in amber, the note with the date, «Continuar desde hoy».
3. **Accessibility.** VoiceOver on a Recurrentes row and on an Inicio commitment row reads the rule (merchant,
   frequency, category, amount, next date) and the hint «Abre el detalle del recurrente» / «Opens the details of
   this recurring item», never «Editar»; the Actions rotor still lists Pausar/Eliminar on the Recurrentes row. On the
   detail, the state is announced when it changes; the Cuenta row reads as a button. The largest Dynamic Type: the
   hero fits, the rows stack, the buttons stay reachable. Reduce Motion; light and dark; both languages.

Record: which screen each row opened from, whether the account balance matched, and any row still landing on the form.

## Producto 25B2 — currency defaults and the account/card lifecycle

**Not done in 25B2: no EAS build was made and the iPhone was not touched.** Metro from this branch
(`npm run start:dev-client -- --clear`) on the installed FinanzApp Dev build; JavaScript only. **The ledger moves to
schema 11 (additive: a tombstone date on accounts, a `deleted` flag on cards) and an older build refuses the file
unchanged: keep a backup first** (Más → Copia de seguridad). Use your own small test data; never seed movements.

**Brief test (≈10 minutes).**

1. **Defaults.** With accounts in one currency only: Más → Cuentas → +, Tarjetas → +, Deudas → +, Presupuestos → +
   all start in that currency. Add a second-currency account: with the chip on "Total · USD" the forms start in USD;
   choose "Solo ARS" and they start in ARS. Delete every account (step 2) and open Cuentas → +: the region's
   currency (Región on España → EUR, on Estados Unidos → USD, on Argentina → ARS).
2. **Chip.** With one currency held Inicio and Reportes show no chip and the number is simply the total; add a
   second currency: the chip appears with the previous choice; delete that account: the chip goes away again.
3. **Delete an account** (one with movements, a transfer and an active recurring rule): a short swipe on its row
   reveals Eliminar; a full swipe opens the confirmation without deleting; Cancelar leaves everything. Confirm: the
   row leaves Cuentas and Disponible; Movimientos still lists its movements and transfers with the account's name;
   Reportes for that month keeps them; Recurrentes shows the rule paused; the account's detail (from a movement)
   reads "Cuenta eliminada" without Editar or actions; Nuevo gasto and Transferir no longer offer it. VoiceOver on a
   row: the Actions rotor lists Eliminar. Also from Editar cuenta → «Eliminar cuenta».
4. **Delete a card** with a purchase, a payment and an active recurring rule on it. Leave some debt first: Tarjetas →
   card → Editar → «Eliminar tarjeta» opens "Todavía no se puede eliminar" naming the debt, with Pagar and Archivar;
   Cancelar changes nothing; Pagar opens the payment capped at the debt. Pay it to zero, then delete: the confirmation
   says purchases and payments stay; confirm: the card leaves the carousel; its purchases and payments stay in
   Movimientos; Recurrentes shows its rule paused, offering Eliminar only (Editar can re-home it, 25B3); force-quit, reopen and background/foreground
   the app past the rule's next date: no new purchase on the card; the detail reads "Tarjeta eliminada" without
   Registrar compra ni Pagar. No swipe on the carousel.
   **History.** Delete the only account in a second currency (with a movement in a previous month): Inicio keeps the
   chip; "Total · ARS" still counts that movement and "Solo USD" shows it; Reportes reaches its month; Disponible and
   Nuevo gasto no longer offer the currency. Open one of its movements → Editar: the account and amount are prefilled;
   correct the amount and save; it stays on that account.
4b. **Delete a debt or receivable** (Más → Deudas y cobros; debt lifecycle round, 2026-09-28). Create «Debo · Juan»
   and record one partial payment: swipe → Eliminar (and from its detail, «Eliminar deuda») opens «Todavía no se puede
   eliminar» naming the rest, with Cancelar, Saldar and Cerrar; opening it and Cancelar change nothing; Saldar opens the
   payment prefilled with the rest; Cerrar moves it to Cerradas with its balance and history and the detail stays open;
   Reabrir brings it back. Pay the rest, then Eliminar: the usual confirmation; confirm: it leaves Deudas and both
   payments stay in Movimientos. A receivable with a partial collection offers Cobrar instead of Saldar. A tracker just
   created with no payment: Eliminar says the balance is not settled and no payment is recorded, and deletes it.
   VoiceOver reads the dialog's buttons in both languages.
5. **Backup.** Export (it is v11 once something was deleted), reinstall or use a second device, import: the deleted
   account and card come back deleted; the older backup from step 0 is refused as contradicting local changes.
6. **Accessibility.** The largest Dynamic Type on Cuentas rows with the swipe open; VoiceOver through the
   confirmations in both languages; Reduce Motion; light and dark.

Record: the schema upgrade (the app opened, the data intact), each form's starting currency, and any deleted row that
still accepted a movement or disappeared from Movimientos.

## Producto 25B — the first opening (a fresh install and an upgrade)

**Not done in 25B: no EAS build was made and the iPhone was not touched.** Metro from this branch
(`npm run start:dev-client -- --clear`) on the installed FinanzApp Dev build; JavaScript only, no native
change, no schema change. Two runs are needed: one over your existing data and one on a clean install.

**Brief test (≈8 minutes).**

1. **Existing data first.** Keep a backup (Más → Copia de seguridad). Update Metro and open the app.
   - [ ] The app opens on Inicio as always: no setup, no changed language, region, currency or data. The Más
     footer reads «FinanzApp 0.1.0 (25B)».
   - [ ] Open the app's scheme at `/onboarding` (Safari: `finanzapp-dev://onboarding`): it lands on Inicio at once,
     nothing drawn, nothing changed.
2. **Clean install.** Delete FinanzApp Dev, reinstall it from its EAS build page, start Metro from this branch.
   - [ ] The splash lifts directly on the welcome ("Tus gastos, claros."), never on Inicio first. No header, no
     back swipe. Set the iPhone to English first for one of the runs: the welcome is in English.
   - [ ] The Idioma and Región rows name the device's values ("Español · según el dispositivo"). Tap Idioma: the Más
     chooser opens over the welcome; choose the other language and go back: the welcome is already in that language.
   - [ ] Continuar → Tu primera cuenta: the currency row shows the region's currency and the note names it
     ("Sugerida por tu región: pesos argentinos"). Tap it and pick Euros: the note drops the claim. Type a name and
     an opening balance in euros (two decimals), Crear cuenta: the setup ends on Inicio by itself, chip "Total · EUR",
     the account in Más → Cuentas with its balance.
   - [ ] Repeat the clean install; on the welcome change the language, then tap Omitir: Inicio's empty state, the
     language kept (Más → Idioma), Región on "Según el dispositivo", the chip "Total · ARS". Force-quit and reopen:
     no setup again; the language still applies.
   - [ ] Once more: Continuar, then Ahora no: Inicio empty, nothing set.
3. **Accessibility.** VoiceOver through both stages in both languages (headers, the Omitir label and hint, the
   rows, the currency note); the largest Dynamic Type on the smallest iPhone you have (both stages scroll; Continuar,
   Crear cuenta and Ahora no reachable; the keyboard never covers the amount); Reduce Motion (a plain fade between
   stages); light and dark.

Record: the language and region the device was in, what the account stage suggested, and anything the flow wrote
that you did not choose.

## Producto 24C1 — consolidated finances (gate of the first TestFlight, not of the merge)

**Not done in 24C1: no EAS build was made and the iPhone was not touched.** Metro from this branch
(`npm run start:dev-client -- --clear`) on the installed FinanzApp Dev build; JavaScript only (expo-sqlite is
already linked: the rate cache is a second SQLite file, `finanzapp-rates-v1.sqlite`; the ledger stays at schema
10). The phone needs internet for the first rates. Use your own small test data; never seed movements. Record
each result with the language, the theme and the text size.

**Brief test (≈10 minutes).**

1. Keep a backup first (Más → Copia de seguridad). Update Metro and open the app.
   - [ ] If you had chosen a currency on Inicio before (24B6), Inicio opens exactly as before and the chip reads
     "Solo ARS" (or your currency): nothing changed by itself. On a fresh install (or after choosing it) the chip
     reads "Total · ARS".
2. Have at least an ARS and a USD account, plus a EUR and a JPY one (create them if needed; small amounts),
   and one expense in each this month, one USD expense in a past month, a card purchase and a card payment.
3. Tap the chip → the sheet: **Total consolidado**, **Ver solamente una moneda**, **Moneda de visualización**.
   - [ ] Choose Total consolidado and ARS: Inicio shows **one** number, no second amount under it. The first time
     it may say "Obteniendo cotizaciones" for a moment, with each currency on its own line.
   - [ ] The ⓘ beside "Septiembre" names Frankfurter and a rate date (the latest publication, a weekday).
   - [ ] Change the display currency to USD, EUR and JPY (JPY without decimals): the number changes; the account
     balances in Más → Cuentas, every movement and its detail keep their own currency and amount.
   - [ ] Disponible: one number for all normal accounts (no card, no debt); its ⓘ says the rate date and that it
     is not your net worth. A negative account lowers it.
   - [ ] The card purchase counts once in Gastos; the card payment is not an expense.
   - [ ] With a general budget in ARS: its card shows the same spent figure in "Total · ARS", "Total · USD" and
     "Solo ARS" (ARS spending only, never the converted euros or dollars); in "Total · USD" its section reads
     "Presupuesto del mes · ARS" and Ver opens Presupuestos in ARS. Reportes' Presupuestos section does the same.
4. Reportes follows Inicio (same mode, same currency). Go back to the past month: the ⓘ beside the total says
   the range of rate dates used, from that month, never today's. Categories, the donut, merchants and budgets
   add up to the total; open a category: its rows show the original amounts.
5. Airplane mode, then force-quit and reopen.
   - [ ] Months already seen still show their total (the rates are cached).
   - [ ] A month never seen (or a new currency) shows each currency on its own line with "Sin cotización para
     sumarlo en …" and an ⓘ saying there is no connection. No partial total, no zero.
   - [ ] Turning airplane mode off and reopening Inicio brings the total back without any action.
6. **Ver solamente una moneda:** Inicio and Reportes return to the 24B6 view (only that currency's accounts,
   nothing converted); the chip reads "Solo USD".
7. Accessibility.
   - [ ] VoiceOver on the chip: "Total consolidado en pesos argentinos" / "Solo dólares estadounidenses", with the
     hint; visually "Total · ARS" / "Solo USD"; in the sheet each option says whether it is selected; the subtotals read each amount with its unit.
   - [ ] The largest Dynamic Type: the chip, the sheet rows and the subtotals wrap without clipping; Reduce Motion
     changes nothing essential. Repeat once in English.

Record: which currencies, the number shown in each display currency (a rough cross-check against a public rate is
enough; a reference rate is not what a bank charges), airplane-mode behaviour, and any row that showed a
converted amount where an original was expected.

## Producto 24UX5 — visual consistency, copy and the recurring audit

**Not done in 24UX5: no EAS build was made and the iPhone was not touched.** Metro from this branch
(`npm run start:dev-client`) on the installed FinanzApp Dev build; JavaScript only, no native change and
no schema change (the ledger stays at schema 10). Record each result with the language, the theme and the
text size. Use your own small test data; never seed movements.

**Inicio (compare with 24UX3; the structure must be identical).**

- [ ] Same order as before: title, Gastos / Disponible, the currency chip, the number, the three pills,
  the Assistant, then Presupuesto del mes (if any), En qué gastaste, Próximos compromisos, Últimos
  movimientos. Nothing new, no extra card.
- [ ] Section links (Reportes, Ver todos, Ver) are a desaturated slate blue (#8EA7D8 in dark, #4A6390 in
  light), with the chevron in the same ink; they read as links, not as body text and not as the cobalt of
  the Assistant or the tab bar. Segments and the currency chip stay neutral. Each link opens what it did
  (Reportes keeps the currency, Ver todos → Recurrentes / Movimientos); VoiceOver says the same names.
- [ ] Próximos compromisos and Últimos movimientos draw the same 40 pt category tile, aligned on one
  column. The agenda rows are tighter (56 pt), the ledger rows a little taller (64 pt); the due day sits
  under the amount, amber for today and tomorrow.
- [ ] A movement with a clear name ("Carrefour") shows only the date under it; one named "f", "a" or
  "Varios" also shows its category ("Comida · Hoy"); two different categories that draw the same icon on
  screen both show their category ("f" and "aa" keep «Comida · Hoy»). With two ARS accounts but every
  visible movement in the same one, no row repeats the account; once the visible rows come from two
  accounts, each shows its own ("Banco · Hoy"). Próximos compromisos decides the same on its own rows;
  its amounts and days do not change.
- [ ] VoiceOver on a movement row still says merchant, Gasto/Ingreso, amount, category, account and date;
  on an upcoming row merchant, category, amount, the estimated day and the account (even when the
  caption leaves it out). The same in English.
- [ ] English: the category section reads «By category»; titles wrap rather than truncate at the largest
  accessibility text size, with the link still reachable.
- [ ] With a budget (general, exceeded), several categories, a second currency and a very large amount,
  switching ARS/USD keeps the order and does not flicker or jump; nothing is remounted in a visible way.

**Reportes.**

- [ ] The month heading reads «Septiembre de 2026» (lower-case «de»; English «September 2026»); the
  same in Presupuestos, and a movement's detail date reads «Martes, 22 de septiembre de 2026». The period
  line under it says «Hasta hoy» with no «· ARS» (the chip and «Gastado · ARS» already name it).
- [ ] Beside «Gastado · ARS» an information glyph opens «Qué cuenta este reporte» (the currency, no
  opening balances, transfers or card payments, a month without records is not a month without
  spending). The paragraph at the end of the screen is gone.
- [ ] With a merchant bought once, the ranking shows it and «Para tener en cuenta» no longer repeats
  «Tu mayor gasto fue …»; with a merchant bought twice the insight stays. Budget warnings stay.
- [ ] The month arrows, «Este mes» and the header «+» buttons are easy to hit (44 pt targets); the
  empty month and the «Día a día» note are one short sentence.

**Más and other screens.**

- [ ] The end of Más reads «FinanzApp 0.1.0 (24UX5)» and, on FinanzApp Dev only, the material and the
  language source under it. The storage note says the records are saved only on this device and work
  offline. Copia de seguridad → Importar no longer says «piloto».
- [ ] Presupuestos with nothing set, and with no category limits: one short sentence each.

**Recurring audit (Recurrentes).**

- [ ] With a rule due today, force-quit and reopen: one movement for today, with today's date; reopen
  again and background/foreground several times: still one.
- [ ] A rule whose due date passed while the app was closed is recorded with the due date (not the
  opening day) the next time the app opens or comes back to the foreground.
- [ ] The empty state, the form's note and the detail's Registrados caption say FinanzApp adds the
  movement when it comes due and that it does not pay, collect or confirm a bank payment.
- [ ] No cosmetic re-check is needed for the backlog fix (review of `2a04d76`): a rule hundreds of dates behind
  is covered by automated real-SQLite and rendered-screen tests (`recurring-audit.node.ts`, `polish-routes`).
- [ ] (Only if one exists; never forge one.) A rule reading «Revisar» in amber: its detail explains
  since when it was not recorded and offers «Continuar desde hoy»; tapping it records nothing for the
  past dates and brings the rule back to its next date.

## Producto 24UX4 — managing recurring rules and debts

**Not done in 24UX4: no EAS build was made and the iPhone was not touched.** Metro from this branch
(`npm run start:dev-client`) on the installed FinanzApp Dev build; JavaScript only, no new native
module (Gesture Handler and Reanimated are already in the build). Record each result with the
language, the theme and the text size. Use your own small test data; never seed movements.

**Before anything else — the schema 10 upgrade (one-way).** Opening this bundle upgrades FinanzApp
Dev's ledger from schema 9 to 10 (one added column per table, every row kept). An older bundle then
refuses the file until this branch (or a later one) runs again.

- [ ] Más → Copia de seguridad → export a backup and keep the file off the phone before the first
  launch of this branch.
- [ ] Launch the branch: Inicio, Movimientos, Reportes, Cuentas, Deudas and Recurrentes show the same
  figures as before; force-quit and reopen: nothing migrates twice, nothing changed.

**Recurrentes (Más → Recurrentes; create two throwaway rules if you have none, e.g. «Prueba A»
monthly and «Prueba B» weekly, and delete them at the end).**

- [ ] The rows no longer carry a switch. Drag a row left: the row follows the finger, Pausar (grey)
  and Eliminar (red, at the far edge) appear under it with white labels; release past about half →
  it stays open; a short drag → it closes. A long fast swipe does *not* delete (it stops at the
  actions). Tapping elsewhere or scrolling does not leave two rows open: opening a second row closes
  the first.
- [ ] Vertical scrolling over the rows still scrolls (no accidental swipe); a tap on a closed row
  opens its detail; the native back swipe from the left edge still goes back.
- [ ] **Pausar** from the swipe: the row moves to Pausados and says «Pausado»; selection haptic; the
  Próximos 30 días and Inicio's Próximos compromisos no longer count it. **Reanudar** (blue) brings it
  back to Activos with its next date today or later on its own day (a rule paused across its due day
  does *not* record the missed one; one resumed on its due day records today once).
- [ ] **Eliminar** from the swipe: an alert «¿Eliminar «Prueba A»?» that names how many movements it
  already recorded and says they stay in Movimientos; Cancelar leaves everything; Eliminar (red)
  removes the row. Then check in Movimientos that every movement it recorded is still there with the
  same amount and date, and that opening one shows no «Recurrente» row any more.
- [ ] **Detail** (tap a rule): after Registrados, «Pausar recurrente» (or, when paused, the note
  «Pausado: …» and «Reanudar recurrente») and a red «Eliminar recurrente». Each writes and closes the
  form; with an unsaved edit in the form, pausing does not apply the edit. Eliminar asks first as
  above; the screen closes without flashing «No encontramos este recurrente». *(Superseded by 24UX6E: the
  paused note sits under the hero without the «Pausado:» prefix; see «Producto 24UX6E» above.)*

**Deudas y cobros (Más → Deudas y cobros; a throwaway «Prueba» debt of a small amount).**

- [ ] A debt with a balance swipes to **Saldar** (blue) and **Eliminar** (red). Saldar opens «Registrar
  pago» with the whole balance already typed; change the account, confirm → the debt reads Saldada.
  A receivable opens «Registrar cobro» the same way.
- [ ] A settled debt swipes to **Cerrar** (grey): no alert, it moves to a new «Cerradas» section at the
  bottom («No cuentan como pendientes») and leaves the totals. A closed row swipes to **Reabrir**
  (blue) and back.
- [ ] **Detail:** after the payments, «Cerrar deuda» (or «Reabrir deuda») and a red «Eliminar deuda».
  Closing a debt with a balance left asks «¿Cerrar la deuda con …?» with the amount and never records
  a payment; the detail stays open and says «Cerrada»; «Registrar pago» is disabled while closed.
- [ ] **Eliminar** (swipe or detail): the alert names how many payments or collections stay in
  Movimientos; after confirming, the debt disappears from Deudas (open and Cerradas), from the totals
  and from Más's count. Its payments are still in Movimientos with «Debo · Prueba» as a side; opening
  one shows the side without a link; Disponible on Inicio is exactly what it was before deleting.
- [ ] The edit form (pencil) no longer has «Archivar deuda».

**Across both.**

- [ ] Both themes: the red, grey and blue action fills read clearly with white labels; the rows are
  opaque over the actions at rest (no colour bleeding through a grouped card's corners).
- [ ] Dynamic Type at the largest accessibility size: action labels stay one line and the buttons
  widen; the detail buttons wrap without clipping.
- [ ] VoiceOver: on a row, swipe up/down reads the Actions rotor («Pausar», «Eliminar» / «Saldar»,
  «Eliminar»…); double-tap on an action runs it (the confirmation alert appears for Eliminar). The row
  label still reads as before (a closed debt says «Cerrada»).
- [ ] Reduce Motion on: the row still follows the finger; the snap open/closed is immediate.
- [ ] English (Más → Idioma → English): Pause/Resume/Delete, Settle/Close/Reopen/Delete, «Closed»,
  the alerts in English.
- [ ] A backup exported after a deletion is v10 and imports on a fresh install with the deleted rule
  and debt still deleted; reviewing the backup from the first step (made before the deletions) on
  this phone shows the conflict message and no Importar button, and nothing comes back.

## Producto 24UX3 — Home hierarchy

**Not done in 24UX3: no EAS build was made and the iPhone was not touched.** Metro from this branch
(`npm run start:dev-client`) on the installed FinanzApp Dev build; JavaScript only, no new native
module. Record each result with the language, the theme, the material and the text size. Use your
own small real data (a few expenses, one recurring rule, ideally two currencies); never seed movements.

- [ ] **First glance.** Open Inicio cold in dark and in light: within a second the eye lands on the
  number first, then the actions, then the sections. Nothing above the number (segments, currency
  chip) competes with it; the screen feels calmer than 24UX2, not emptier.
- [ ] **Header.** Gastos / Disponible and the currency chip are 32 pt tall, the chosen label in ink
  (not cobalt), easy to hit with a thumb (44 pt target); the thumb still slides (Reduce Motion: jumps).
  In dark the chosen segment is clearly lifted (a lighter thumb with a thin edge) and reads as the
  current state at a glance, without blue. With three or more currencies the chip is the compact
  "ARS ⌄" row with a thin edge and opens the sheet.
- [ ] **Number.** 48 pt with visible room above and below; a long amount still fits on one line
  (shrinks, never clips); Disponible's info glyph and "N cuentas" still read.
- [ ] **Pills.** Gasto, Ingreso, Transferir: equal width, one line each on the narrowest iPhone at
  hand (on a 375 pt phone "Transferir" may shrink slightly, never truncate); glyphs coral/green/azure;
  press scales to 0,97; each opens its form with the currency carried over. They do not read as filters.
- [ ] (Superseded by decision 005, 2026-09-30: the Assistant is no longer a tab; it is the first choice of the dock's «+» hub and a
  stack screen — see 24UX6A.) **Assistant entry — prominence and ergonomics.** Reads as the most important control after the
  number without looking like a banner or an ad; the wash is subtle in both themes; it does not read
  as a search field. One-handed on a 6,1″ iPhone: reach it with the thumb without regripping (note
  whether it is easier than the old first disc). Tapping switches to the centre tab (no stacked
  copy) and the conversation keeps Inicio's currency.
- [ ] **Liquid Glass** (iOS 26, development build, Reduce Transparency off): pills are regular glass,
  the Assistant entry glass with a faint cobalt wash; turn Reduce Transparency on and the opaque
  material appears without relaunch.
- [ ] **Section rhythm.** En qué gastaste is the only card (52 pt rows, washes reveal as before);
  below it Próximos compromisos (tight agenda: small marks, the due day) and Últimos movimientos
  (open ledger: full rows, larger marks, signed amounts) sit on the background, aligned with their
  titles, hairlines under the text, a tap dims the row. No card → list → card cut; the two lists
  read as two different things, not one long list.
- [ ] **Links.** Reportes / Ver / Ver todo are grey with a grey chevron, clearly tappable, open the same
  screens as before (Reportes keeps the currency).
- [ ] (Superseded by decision 005, 2026-09-30: Forest replaces cobalt.) **Cobalt balance.** Count the cobalt on screen: the Assistant's glyph and edge, the active tab.
  Nothing else competes.
- [ ] **Dynamic Type** at the default, the largest standard and the largest accessibility size: the
  pills stack at full width with wrapping labels; the Assistant entry grows in height and its label
  wraps; the header stacks; section rows stack their amounts; nothing clips or overlaps.
- [ ] **VoiceOver.** Order: title, Gastos/Disponible (selected state), currency, month, amount (one
  element with currency), "Registrar gasto", "Registrar ingreso", "Transferir entre cuentas",
  "Contale al Asistente, botón" + its hint, then each section header and its "Reportes"/"Ver todo"
  button, category rows (name, amount, share), commitments (merchant, category, amount, next
  payment), transactions. In English: "Ask the Assistant".
- [ ] **Reduce Motion.** Switching Gastos/Disponible and currency cross-fades the number without
  movement; the category fills fade in without growing; sections appearing fade only.
- [ ] Reportes: «Dónde más gastaste» is an open ranked list under the donut's category card (rank,
  small mark, hairline under the text), no longer a second heavy block; it and «Para tener en
  cuenta» show no subtitle; the donut and the category list are unchanged.
- [ ] Account detail: the same three pills, each opening its form with the account preselected.
- [ ] Más footer reads "Producto 24UX3".

## Producto 24UX2 — merchant identity and Home refinement

**Not done in 24UX2: no EAS build was made and the iPhone was not touched.** Metro from this branch
(`npm run start:dev-client`) on the installed FinanzApp Dev build; JavaScript only, no new native
module. Record each result with the language, the theme and the text size it was checked in. Use
your own small real data; never seed movements.

- [ ] (Superseded by 24UX3's pills and Assistant entry.) Inicio, light and dark, opaque material and Liquid Glass (iOS 26 without Reduce Transparency):
  the four actions are 48 pt flat discs with a hairline edge, no shadow and no cobalt halo; the
  Asistente still reads as the first of the family (cobalt glyph on a soft tint); the hero is the
  heaviest element on screen. Press feedback still scales to 0,97.
- [ ] (Superseded by 24UX3.) The actions at the largest accessibility text sizes on the narrowest phone available:
  "Transferir" wraps to two lines, nothing clips, the four columns stay equal and tappable.
- [ ] Próximos compromisos: each row shows merchant, the category below (and the account only if
  another account of that currency exists), the amount and "Hoy" / "Mañana" / "En N días" / a date
  beside it; the date is not repeated on the left. VoiceOver reads merchant, category, amount and
  "próximo pago …".
- [ ] Últimos movimientos with one account in the currency: no account name in the rows; add a
  second account in the same currency and the names appear.
- [ ] A month with nothing recorded in the currency (switch to a currency without movements this
  month): one sentence under Últimos movimientos, with the currency code when several are held; no
  En qué gastaste title. Record the first expense: En qué gastaste fades in and the neighbours glide
  (Reduce Motion: the fade only).
- [ ] Más → Recurrentes: "Mensual · Categoría · Cuenta" on the left, the day on the right; a paused
  rule is drawn at full contrast with "Pausado"; VoiceOver on a paused rule says "pausado" and no
  date.
- [ ] Open a rule that has already recorded payments: "Registrados" lists them, newest first, with
  the note that the next date is an estimate; tap one → the movement's detail. A rule that has not
  recorded anything says so.
- [ ] A movement recorded by a rule: its detail shows "Recurrente · Mensual"; tapping opens the rule.
  A typed movement does not show it.
- [ ] (Superseded by decision 005, 2026-09-30: the dock is icon-only, no cobalt.) The tab bar's inactive labels (secondary ink) in both themes: legible without competing with
  the selected cobalt tab.
- [ ] Development bundle with `EXPO_PUBLIC_MERCHANT_MARK_PREVIEW=1`: rows named "Netflix",
  "spotify", "Mercado Pago", "Disney+", "App Store" show the brand's initial on a neutral tile;
  "Apple", "Steam", "Pago Netflix", "Personal", "Almacén" and every other name keep their category
  glyph; the large tile in a movement's detail too. Without the flag (and in any release build)
  every row shows its category glyph as before: no logo exists in this build.
- [ ] A rule moved to another account of the same currency (or one recorded payment corrected onto
  another account): its Registrados rows name each payment's own account; a rule whose payments
  are all in its current account shows no account names. VoiceOver names the account on every row.
- [ ] Más footer reads "Producto 24UX2".

## Producto 24UX1 — the date sheet's corrected entrance (the owner's video, second 91)

**Not done in 24UX1: no EAS build was made and the iPhone was not touched.** Metro from this branch
(`npm run start:dev-client`) on the installed FinanzApp Dev build; no preview flag needed. The 24B6
sheet started its rise in the same effect that mounted the modal, so the first painted frame already
showed the card most of the way up; now the modal mounts with the card below the window, and the
rise starts once iOS has presented the modal and measured the card. Judge it in a development build
at least; a release build on the slowest device is the real verdict (a dev build's JS thread hides jank).

- [ ] Nuevo gasto → Fecha: the card comes from below the bottom edge and settles over about 300 ms
  on the iOS sheet curve; the dimming fades in over the same time; no frame shows the card already
  in place, and nothing of the card is visible before it starts rising (also at the largest
  accessibility text size, where the card is taller).
- [ ] Listo, Cancelar and a tap on the dimmed area: the card leaves downwards over about 200 ms and
  the dimming clears with it; the form has not moved; the next tap on the form works at once (no
  invisible modal is left).
- [ ] Fast opens and closes: tap Fecha and Cancelar at once, five times; tap Fecha, Cancelar, Fecha
  within half a second (the card reverses mid-exit without a jump and without re-presenting); tap
  Fecha twice quickly. Nothing stays half-shown, nothing stays blocking, Cancelar never saves.
- [ ] Reduce Motion on (Settings → Accessibility → Motion): the card and the dimming fade in place
  over about 300 ms and out over about 200 ms, with no vertical movement; nothing appears or
  vanishes instantly (the sheet's timings carry Reanimated's `ReduceMotion.Never`, so the device
  setting cannot shorten the fade; PR #54 review). Toggle the setting with the form open and open
  the sheet again: the new behaviour applies without restarting.
- [ ] Keyboard open on Concepto, then tap Fecha: the keyboard closes first, the card rises over a
  form that has not jumped; Cancelar returns to the form with the keyboard closed.
- [ ] Light → Dark and back with the sheet open (Control Centre or Settings): the card and the
  dimming take the new palette without reopening; the wheel's text stays legible.
- [ ] VoiceOver: the first element read once the card is up is Cancelar, then "Elegir fecha", then
  Listo, then the wheel's columns; nothing behind the dimming is reachable; two-finger Z cancels;
  the row's date is announced written out.
- [ ] Dynamic Type at the largest accessibility sizes: the header wraps to two lines, the card is
  taller and still fully rises from below the edge, the wheel keeps its native size, the last row
  of the wheel clears the home indicator (iPhone 14 Pro and a phone without a home indicator).
- [ ] Transferencia and Recurrente → Próxima fecha use the same sheet and behave the same; Cuenta,
  Categoría and Moneda still open their unchanged page sheets.
- [ ] The date semantics are untouched: Cancelar keeps the saved day, Listo saves the spun day,
  yesterday is allowed and tomorrow is not on a movement, Recurrente allows a future date.

## Producto 24R2A — native Idioma/Región choosers, regions in the development preview

**Not done in 24R2A: no EAS build was made and the iPhone was not touched.** Metro from this branch on
the installed FinanzApp Dev build; no new native build is needed (no native module, no Info.plist
change). Record each result with the language and the iPhone Region it was checked in.

**Release gate (Metro without the flag: what a release shows):**
- [ ] Más → Idioma: «Según el dispositivo» on top with «Ahora: …», then one card with Español and
  English; no search field, no «Recientes», no letters; «English» read by an English voice. A tap
  changes the app in place (this title included); the checkmark moves; nothing remounts.
- [ ] Más → Región: «Según el dispositivo», then one card with Argentina and Estados Unidos, each with
  its sample («22/9/2026 · 1.234,56», «9/22/2026 · 1,234.56»); the footnote below the card; no
  «Vista previa» sentence.
- [ ] Largest accessibility text size: rows wrap, nothing truncates or overlaps, the checkmark stays
  aligned; VoiceOver reads «Según el dispositivo», each row, «seleccionado» on the checked one.
- [ ] Nuevo gasto open with «1234,5» typed, then Región changed from iOS Settings (with «Según el
  dispositivo») Argentina → Estados Unidos: the field reads «1,234.5», the caret stays, saving records
  the same amount.

**Development preview (`EXPO_PUBLIC_LOCALE_PREVIEW=1 npm run start:dev-client -- --clear`):**
- [ ] Más → Región lists 257 regions: the search field, «Recientes» after a choice (next visit), letter
  sections; the footnote says the preview is unverified. Scroll top to bottom fast: no blank rows or
  stutter at 60/120 Hz; the letter headers are read as headers by VoiceOver; Reduce Motion changes
  nothing in the list.
- [ ] With the search field focused and the keyboard up, at the largest accessibility text size and with
  VoiceOver: scroll to the end; the last region (Zimbabue), the save-error line (force it only if a
  failure can be produced) and the footnote scroll fully above the keyboard; with the keyboard dismissed
  (drag down, interactive), the footnote clears the home indicator; the first row is never under the
  navigation bar.
- [ ] Search «japon», «JP», «JPN», «392», «CHF»: Japón first for the first four, Suiza among the results
  for the last; «xyzzy» says «Sin coincidencias» under the field while «Según el dispositivo» stays.
- [ ] Choose India: Inicio, Movimientos and Reportes write «1,23,456.78»-style amounts and «22/9/2026»;
  Nuevo gasto types «1234567» as «12,34,567»; delete across a comma removes the digit before it; the
  pad's decimal key (whatever it shows) writes «.».
- [ ] Región on «Según el dispositivo», Nuevo gasto open with «1234567» typed and the caret between two
  digits; set iOS Settings → Region to Switzerland, France and Poland in turn (a form is a modal, so the
  change comes from iOS): «1'234'567», «1 234 567» (narrow space), «1 234 567» (no-break space); the caret
  stays between the same digits and saving records the same amount.
- [ ] Paste «12,34,567.89» (India), «1'234.56» (any region), «1.000» in Suiza (refused with the note),
  «١٢٣٫٤٥» (123.45 in the region's writing).
- [ ] With Japón chosen in the preview, restart Metro **without** the flag: Más → Región shows Japón
  checked with «Todavía no disponible en esta versión · formatos de …», the Más row says «Japón ·
  formatos de …», amounts use the stand-in's formats; choose Argentina and it replaces Japón.
- [ ] No movement, balance, account currency or backup changed through any of the above.

## Producto 24M — 144 currencies opened (gate of the first TestFlight, not of the merge)

**Not done in 24M: no EAS build was made and the iPhone was not touched.** Metro from the branch on the installed
FinanzApp Dev build, no flag (what a release offers), unless an item says otherwise. **Keep a backup first**
(Más → Copias de seguridad → Exportar) and use test data only. Record each result with the language and Region.

- [ ] **The sheet over 146 currencies:** Más → Cuentas → Nueva cuenta → Moneda: ARS and USD on top, then by name;
  scroll to the end fast (no blank rows); search «yen», «JPY», «392», «Japón», «€», «dólar» (many); the largest
  accessibility text size (names wrap, nothing truncates); VoiceOver reads «Euros, EUR»; with the keyboard up the last
  currency and the note stay reachable; «kuwait» finds nothing (held).
- [ ] **Two decimals (EUR) — an account, a card, a debt, a budget, a recurring rule:** type «1234,56» (the pad has its
  decimal key); a purchase on the card and its payment; Inicio's switch shows EUR alone, never added to pesos; Reportes
  in EUR; VoiceOver reads «1234,56 euros».
- [ ] **No decimals (JPY):** the pad has **no** decimal key; «1500» saves 1500 yen (not 15,00); pasting «12,5» is
  refused; VoiceOver reads «1500 yenes japoneses».
- [ ] **Two decimals shown whole (COP):** «150000» shows «150.000»; «1500,5» shows «1.500,5» (a recorded fraction is
  never hidden).
- [ ] **A backup round trip:** export with EUR, JPY and COP accounts, restore on a copy (or after reinstalling
  FinanzApp Dev): every balance identical; a recurring rule deleted before the export stays deleted.
- [ ] **Regions:** with Región Alemania and Suiza, the EUR and CHF amounts group as docs/region-families.md §1 says.
- [ ] **Three decimals, preview only (`EXPO_PUBLIC_CURRENCY_PREVIEW=1`), decides the held seven:** a KWD account, an
  expense of «1,234» (one dinar, 234 fils); with VoiceOver in Spanish and in English, and with iOS Region set to
  Argentina and to the United States, record exactly what the voice says for the amount in the row and in the detail.
  «un coma doscientos treinta y cuatro dinares» / «one point two three four» passes; «mil doscientos treinta y
  cuatro» or «one thousand…» fails and keeps them held.

## Producto 24R2B — 234 regions released (gate of the first TestFlight, not of the merge)

**Not done in 24R2B: no EAS build was made and the iPhone was not touched.** Metro from the branch on the
installed FinanzApp Dev build, **without** the preview flag (what a release shows); no new native build is
needed. The expected strings are in [region-families.md](region-families.md), generated from the code; check
each row in Spanish and in English and record the result here.

- [ ] **Eight number families** (region-families.md §1): with iOS Region set to Alemania, Reino Unido,
  Francia, Suecia, Polonia, Suiza, España and India in turn: Nuevo gasto typing «1234567», the pad's
  decimal key, «89» shows the row's «Typed» value; the caret stays after the last digit; deleting the
  group separator removes the digit before it; pasting the row's refused text keeps the field and shows
  the note; saving records the amount and Inicio shows it grouped the same way; VoiceOver reads the saved
  amount ungrouped.
- [ ] **Date writings** (§2): Corea, Hungría, Croacia, Finlandia and Dinamarca at least: a movement's date,
  Reportes' day of the month, the backup date and time; the spaces never break a date across lines.
- [ ] **Chooser with 234 rows:** Más → Región opens fast; scroll top to bottom at 60/120 Hz without blank
  rows; search «japon», «JP», «JPN», «392», «CHF», «corea»; «Recientes» on the next visit; letter headers
  read as headers by VoiceOver; the largest accessibility text size; with the keyboard up, the last region
  (Zimbabue) and the footnote reachable; the first row never under the navigation bar.
- [ ] **Device first, choice wins:** with «Según el dispositivo», changing iOS Region (Japón → Brasil)
  changes the formats live; after choosing Suiza manually, an iOS Region change does nothing and a
  force-quit keeps Suiza; account currencies and balances never change.
- [ ] **A blocked region:** iOS Region Arabia Saudí: Más → Región reads «Ahora: Arabia Saudí (formatos de
  Argentina)».
- [ ] **Per numbering system, evidence only (no stage opens from it):** for each row of region-families.md §4
  (Arabia Saudí `arab`, Irán `arabext`, Bangladés `beng`, Nepal `deva`, Myanmar `mymr`, Bután `tibt`), with iOS
  Region set there and, separately, iOS's Numbers setting on Latin and on native digits: record which digits
  and which decimal key the pad actually offers (do not assume CLDR's default), what the field shows after
  «1234567», the decimal key and «89», what a pasted native amount gives and how VoiceOver reads it. Expected
  today: `arab`/`arabext` digits read as Latin; `beng`/`deva`/`mymr`/`tibt` digits enter nothing and a paste
  is refused (not normalized yet).

## Producto 24R1 — regional infrastructure (one visible line; nothing else until 24R2)

**Not done in 24R1: no EAS build was made and the iPhone was not touched.** Metro from this branch on
the installed FinanzApp Dev build; no new native build and no flag needed.

- [ ] Settings → General → Language & Region → Region: Japan (keep the language). Reopen FinanzApp
  (the app keeps running; iOS posts its locale event): Más → Región → "Según el dispositivo" reads
  "Ahora: Japón (formatos de Argentina)" in Spanish and "Now: Japan (Argentina formats)" in English;
  every amount, date and the amount field still write Argentine formats; no movement, balance or
  currency changed.
- [ ] Region back to Argentina, then United States: the plain "Ahora: Argentina" / "Ahora: Estados
  Unidos"; with "Según el dispositivo" the formats follow; with a manual choice (Argentina) nothing
  moves and Más → Región still marks Argentina.
- [ ] Force-quit and reopen with the Region still set abroad: the same sentence, the same formats.
- [ ] Más footer (24UX1 or later; it said "Producto 24R1 ·" when this section was written): "Producto 24UX1 · …".

## Producto 24B6 — the date sheet, one display currency, the card rules

**Not done in 24B6: no EAS build was made and the iPhone was not touched.** No new native build is
needed: Metro from this branch (`npm run start:dev-client`) on the installed FinanzApp Dev build
`1d69d2d4` or later; the preview flag is not required for any 24B6 check. Record each result with
the language it was checked in.

**The date sheet (Nuevo gasto → Fecha; also Transferencia, Recurrente → Próxima fecha):**
- [ ] The sheet is a card at the bottom of the screen, as tall as its header and the wheel, over
  a dimmed but visible form; the wheel is centred in the card, not floating in an empty page; the
  grabber, Cancelar · Elegir fecha · Listo and the wheel read in the interface language (es, en)
  with the day, month and year order of 23.1C2.
- [ ] Opening: the dimming fades in while the card rises from the bottom edge (about 200 ms),
  with no jump of the form behind it; Listo, Cancelar or a tap on the dimmed area: the card
  leaves downwards (about 100 ms) and the form has not moved. Nothing overlaps the tab bar or
  the keyboard (the keyboard closes first).
- [ ] The card's bottom padding clears the home indicator (iPhone 14 Pro: the wheel's last row
  is fully visible above it); in landscape the sheet still fits or scrolls nothing off screen.
- [ ] Reduce Motion on: the sheet and the dimming fade in and out with no vertical movement.
- [ ] Dark Mode: the card is the elevated surface (`#1C1C1E`), the wheel's text is legible, the
  dimming is darker than in Light Mode; Light Mode: a white card over a light grey dimming.
- [ ] Dynamic Type at the largest accessibility sizes: the header wraps to two lines and
  nothing clips; the wheel keeps its native size.
- [ ] VoiceOver: the first element read is Cancelar, then the header "Elegir fecha", then Listo,
  then the wheel's columns (adjustable); swiping never reaches the form behind the sheet; the
  scrim is not an element; the Escape gesture (two-finger Z) cancels.
- [ ] Spin to another day, Cancelar: the row keeps the old day; open again: the wheel shows the
  saved day. Spin, Listo: the row shows the new day. Yesterday is allowed, tomorrow is not on a
  movement; Recurrente allows a future date.
- [ ] Cuenta, Categoría and Moneda still open the full page sheets of before (unchanged).

**One display currency (with at least an ARS and a USD account):**
- [ ] Inicio → choose USD; Reportes shows USD without touching its switch; Reportes → choose ARS;
  Inicio shows ARS. The month and the Categorías/Días view of Reportes do not change with the
  currency.
- [ ] Choose USD, force-quit the app, reopen: Inicio and Reportes open on USD.
- [ ] Inicio → "Reportes" from the categories section lands on the same currency Inicio shows.
- [ ] With a single currency (a fresh ledger or only ARS accounts) neither screen shows a switch;
  with three currencies (the preview gate) both show the compact row that opens the sheet, and the
  choice still travels between them.
- [ ] Más → Copia de seguridad → export, then restore the copy: the shown currency does not change
  and the copy contains no currency preference.

**Card flows (with a card and a cash account in ARS):**
- [ ] Inicio "+" → Ingreso: the account sheet lists cash accounts only (no card, no debt).
- [ ] Tarjetas → Registrar compra: Gasto opens on the card; switch the control to Ingreso: the
  account becomes the cash account in the card's currency and the sheet shows no card; switch
  back to Gasto: the card is selected again. Save a purchase: one expense on the card, the card
  debt rises, Inicio's month spending rises once.
- [ ] Tarjetas → Pagar tarjeta: the card is the fixed destination, "Desde" lists cash accounts in
  the card's currency only, "Pagar total" fills the outstanding balance; saving lowers the cash balance
  and the card's balance due and adds no expense.
- [ ] Inicio "+" → Transferencia: neither "Desde" nor "Hacia" lists a card or a debt.
- [ ] Deudas → a debt's Registrar pago and a receivable's Registrar cobro still work as before.
- [ ] If the test ledger holds an income on a card from before (a refund recorded through Ingreso
  before 24B6): open it from Movimientos, change its amount, save: it stays on the card. Otherwise
  note "no historical card income on this device".
- [ ] Asistente (fixture mode, `EXPO_PUBLIC_ASSISTANT_FIXTURES=1`): an income draft never proposes
  the card; an expense draft still asks which account when a card and a cash account exist.

## Producto 24A — currency foundations (nothing new to see; a regression spot-check)

No new build is required: 24A is JavaScript only (the next development build also carries
the 23.2 patch natives). Metro from this branch on FinanzApp Dev `1d69d2d4`.

- [ ] Más footer: "Producto 24A · …".
- [ ] Amounts read as before in Español·Argentina and English·United States: Inicio hero
  ("$ 1.234,56" / "AR$ 1,234.56"), a USD account ("US$"), Cuentas section titles "Pesos
  argentinos" / "Dólares estadounidenses" (English "Argentine pesos" / "US dollars"), the
  entry detail's currency row, VoiceOver on one amount ("… pesos", "… dólares").
- [ ] Nuevo gasto, Nueva cuenta, presupuesto, tarjeta and deuda still offer exactly ARS and
  USD; nothing mentions other currencies.

## Producto 23.2 — which binary is installed, and the per-app Language row

**No new build and no reinstall-from-scratch.** Do not uninstall FinanzApp Dev or delete
its data. Record the iPhone model and iOS version (`UIPrefersShowingLanguageSettings` was
introduced at WWDC24, iOS 18; last recorded iOS 26.6.1).

Owner report (2026-09-24): 23.1C2 passed inside the app (Más → Idioma/Región, Spanish,
English, both regions), but Settings → Apps → FinanzApp Dev lists Local Network, Siri,
Search and Cellular Data and **no Language**.

Diagnosis on Linux (compiled `Info.plist` of the IPAs downloaded from EAS; method in
`apps/mobile/README.md` § Producto 23.2):

| EAS development build | commit | `CFBundleLocalizations` | `CFBundleDevelopmentRegion` | `UIPrefersShowingLanguageSettings` |
| --- | --- | --- | --- | --- |
| `1d69d2d4` (2026-09-24 12:26 UTC) | `cc6f6f9` (23.1C2) | array `[es, en]` | string `es` | boolean `true` |
| `bad52629` (2026-09-23) | `634d293` | absent | string `en` | absent |
| `ed369b28` (2026-09-22) | `f14b16a` | absent | string `en` | absent |

`1d69d2d4` is correct, with the types Apple expects; its native fingerprint (`796b0b4…`)
equals master's. No bundle contains an `.lproj` folder (Expo's template has none; iOS
reads the languages from `CFBundleLocalizations`). Every development build reports
0.1.0 (1), and a development client runs whatever JavaScript Metro serves, so the
selectors in Más prove nothing about the binary.

**A. Identify the installed binary** (Metro from `master` or this branch, both fine)
- [ ] With the iPhone in Spanish, long-press the Movimientos search field. **Pegar /
  Copiar / Seleccionar todo** = a binary that declares its languages (`1d69d2d4`). **Paste /
  Copy** = an older binary (`bad52629` or `ed369b28`): the 23.1C2 build is not installed.
- [ ] If it reads Paste: share a private backup (Más → Copias de seguridad), then install
  the **existing** build `1d69d2d4` over FinanzApp Dev from
  https://expo.dev/accounts/facur3/projects/finanzapp-mobile/builds/1d69d2d4-c018-485c-b093-9d3b58f88a62
  (Install on the iPhone; same bundle identifier, data kept; it expires 2026-10-08). No new
  EAS build is needed. Repeat A.

**B. The Language row on the 23.1C2 binary** (after A reads Pegar)
- [ ] Force-quit Settings (app switcher, swipe up), reopen, Apps → FinanzApp Dev. Record
  whether Language/Idioma appears.
- [ ] If not: Settings → General → Language & Region → Add Language → English, keeping
  Español first ("Keep Español"). Force-quit Settings, reopen, Apps → FinanzApp Dev.
  Expected: Language, listing exactly Español and English. Record the row's title.
- [ ] Still missing: restart the iPhone once and look again.
- [ ] Per-app selector (Más → Idioma on "Según el dispositivo"): choose English in
  Settings → Apps → FinanzApp Dev → Language; iOS quits FinanzApp; reopen (Metro running): FinanzApp and the text-field menu in
  English, data intact. Back to Español. Then set Más → Idioma = Español explicitly and
  English in Settings: FinanzApp's words stay Spanish, iOS's menu English (documented).
  Restore both.
- [ ] Remove English from the preferred languages again (Español only), force-quit Settings:
  record whether the row **stays** (that is what `UIPrefersShowingLanguageSettings` adds).

**C. Report back:** the iOS version, A's menu words, B's four results (row title, options,
with one and with two preferred languages). If the 23.1C2 binary shows no row even with
two preferred languages, the remaining difference from a typical Xcode app is that the
bundle has no `.lproj` folder; the first-party candidate is Expo's `locales` key (writes
`es.lproj`/`en.lproj/InfoPlist.strings` at prebuild), which needs a new build. It is
proposed only on that evidence, not started.

## Producto 23.1C2 — English and the United States released

Owner, 2026-09-24, FinanzApp Dev: the Más selectors, Spanish, English and both regions
passed. The Settings Language row was missing; it is diagnosed in Producto 23.2 above.

**Needs a new FinanzApp Dev build** (Info.plist changed: `CFBundleLocalizations`
es/en, `CFBundleDevelopmentRegion` es, `UIPrefersShowingLanguageSettings`). Record the
iPhone model and iOS version (last recorded: iPhone 14 Pro, iOS 26.6.1). Share a private
backup first (Más → Copias de seguridad). Build **only** the `development` profile: it
replaces FinanzApp Dev in place (bundle identifier `com.facur3.finanzapp.dev`, local data
kept); FinanzApp Preview (`com.facur3.finanzapp.preview`) is not built or touched.

```bash
cd apps/mobile
git fetch origin && git checkout feat/mobile-producto-23-1c2-i18n-release && git pull
npm ci
npx eas-cli@latest whoami                                   # facur3
APP_VARIANT=development npx expo config --type introspect --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const c=JSON.parse(s),p=c.ios.infoPlist;console.log(c.ios.bundleIdentifier,p.CFBundleLocalizations,p.CFBundleDevelopmentRegion,p.UIPrefersShowingLanguageSettings)})"
# expected: com.facur3.finanzapp.dev [ 'es', 'en' ] es true
npx eas-cli@latest build --profile development --platform ios
# open the build page URL (or its QR) on the iPhone → Install; it updates FinanzApp Dev
npm run start:dev-client -- --clear                         # no EXPO_PUBLIC_LOCALE_PREVIEW
```

**A. Before installing** (current FinanzApp Dev, EAS build bad52629): long-press the
Movimientos search field and note whether the menu says Paste/Copy or Pegar/Copiar
(expected: English today); tap an ⓘ glyph and note the alert button.

**B. First launch of the new build**
- [ ] Más footer: "Producto 23.1C2 · … · Idioma: módulo nativo". Más → App y datos shows
  Idioma and Región (globe glyph), in that order, without any flag.
- [ ] If English or Estados Unidos was chosen during the 23.1C1 preview, the app opens that
  way and Más marks it: expected (the choice was saved on the iPhone and is now
  released). Set both back to "Según el dispositivo" before section D.
- [ ] Idioma lists Según el dispositivo ("Ahora: Español"), Español, English; no "por ahora"
  note. Región lists Según el dispositivo, Argentina (22/9/2026 · 1.234,56), Estados
  Unidos (9/22/2026 · 1,234.56). Each tap re-renders in place (the title too), with the
  selection haptic; nothing restarts.
- [ ] Force-quit and reopen: the choices persist.

**C. iOS Settings and iOS's own text**
- [ ] Settings → Apps → FinanzApp Dev → Idioma (Language) exists even with a single
  preferred language and lists **exactly** Español and English. Record the row's title.
- [ ] Spanish iPhone: the text-field menu reads Pegar/Copiar/Seleccionar todo; the share
  sheet (backup export) is in Spanish; the ⓘ alert button reads "OK" and VoiceOver's
  two-finger scrub (escape) closes it.
- [ ] Choose English there with Más → Idioma on "Según el dispositivo": iOS quits the app;
  reopen: FinanzApp and the menus are in English, Más → Idioma "Same as device · Now:
  English", region unchanged, data intact. Record whether iOS added English to the
  iPhone's preferred languages. Then set Más → Idioma = Español explicitly: FinanzApp's
  text is Spanish while iOS's menu stays English (documented). Restore both.
- [ ] Optional: make Português the only preferred language: FinanzApp **and** iOS's menus
  in Spanish (fallback language es). Restore.

**D. Changes made while the app runs** (Idioma and Región on "Según el dispositivo")
- [ ] Open Nuevo gasto, type 1234,5 (caret after the 4), pick a category and yesterday.
  Settings → General → Language & Region → Region → United States, return with the app
  switcher: **no relaunch**, the same sheet, the field reads 1,234.5 with the caret after
  the 4, category and date unchanged; typing 9 gives 12,349.5; save; switching back shows
  $ 12.349,50. Repeat after a minute in the background. Record any case that only
  updates after a relaunch.
- [ ] Same with Región explicitly Argentina in Más: nothing on screen changes; Más → Región
  "Según el dispositivo" reads "Ahora: Estados Unidos".
- [ ] Open the date sheet, spin to another day, change the Region and return: the sheet is
  still open with that day; Listo saves it.
- [ ] iPhone Language → English with an unsaved Nuevo gasto open: iOS relaunches the app
  (the unsaved form is gone: iOS behaviour); saved movements intact; the app reads English.
- [ ] In-app: set an Actividad search, move Reportes to the previous month, leave an
  Asistente conversation with a draft card; Más → Idioma English → Español and Región US →
  AR: every tab keeps its state, the draft card and chips stay.

**E. VoiceOver** (first, without FinanzApp: in Notes, write one per line `1.234,56`,
`1,234.56`, `1234,56`, `1234.56`, `180000,00`, `9999999999999,99`, `-5,00`, `12,4 %`, `ARS`,
`USD`, `15 sep`, and read them with the rotor in Español·Argentina, Español·Estados Unidos,
English·Argentina, English·United States; record the voice in Accesibilidad → VoiceOver →
Voz and exactly what is said)
- [ ] FinanzApp in the four combinations: Inicio hero and budget card, a movement row, an
  account row, an Actividad day header, the Reportes day row and a budget row, the entry
  detail budget row, the transfer form's account cards and "Usar todo", the card usage
  caption, an Asistente evidence row (a category that grew: "… 42500,00 pesos más"). Expected: "… mil doscientos treinta y cuatro coma
  cincuenta y seis pesos" / "one thousand two hundred thirty-four point five six pesos",
  never "punto" or "coma" before three digits. Record how "ARS"/"USD" and "15 sep" are read.
- [ ] Spanish iPhone with Más → Idioma English: content rows switch to an English voice;
  record what keeps the Spanish voice (headers, back button, tab bar, alerts, date wheel,
  "botón", the paste-refusal announcement). Spanish iPhone with Idioma Español: the voice
  is exactly the one used before this build.
- [ ] Idioma screen: "English" is pronounced in English, "Español" in Spanish.
- [ ] Asistente with English chosen (fixture build, `EXPO_PUBLIC_ASSISTANT_FIXTURES=1`): the
  app's own question ("What did you pay with?") is read in the interface voice, the
  Spanish sample answer in a Spanish voice.
- [ ] Per-app English (section C) with Más on "Según el dispositivo": record whether
  VoiceOver switches to an English voice for FinanzApp.

**F. Date wheel** (Fecha in Nuevo gasto, the four combinations): Spanish shows
day · month · year with Spanish months, English month · day · year with English months,
matching the row above, in both regions. Record capitalization and full/abbreviated
months. VoiceOver on the Fecha row reads the long date. No "onChange is deprecated"
warning in the Metro console.

**G. Every screen in English and in es-US** (category names, errors, budgets, cards,
reports, forms): Inicio, Movimientos, a detail, Nuevo gasto/transferencia (a card payment
reads "Outstanding ARS 50.00", not "ARS Outstanding"; paying it all shows "Visa después: Sin saldo pendiente"), Reportes (the largest-expense insight shows the
day as 9/22 in the US and 22/09 in Argentina; "Compare with previous month"), Tarjetas
("Outstanding balance", "Statement open since yesterday"), Deudas ("Due today"), Presupuestos,
Recurrentes ("Create recurring item"), Cuentas, Categorías (Transportation,
Entertainment), backup import, Asistente. Trigger a budget duplicate (a second general
budget for the same month and currency): the error is in English. Largest Dynamic Type on
Más, Idioma, Región and Nuevo gasto: nothing clipped.

## Producto 23.1C1 — regional formats and the amount field (pending device review)

No native change: the installed **FinanzApp Dev** runs this PR from Metro. From
`apps/mobile`: `git pull`, `npm install`, then one of the two runs below and reload.
Share a private backup first. English and the United States stay **unreleased**: a
normal run must look like 23.1B2 except the items marked *changed*.

**A. Normal run** (`npm run start:dev-client -- --clear`), Spanish · Argentina:
- [ ] Más footer reads "Producto 23.1C1"; Más shows Idioma and **no** Región row; Idioma
  lists "Según el dispositivo" and Español only.
- [ ] Amount field, as in 23.0: type 999 then 1 → 9.991 without the "$" or the digits
  moving; 999999 → 999.999, then 1 at the start → 1.999.999 with the caret after the 1;
  1000000 typed fast; "," then two decimals; a third decimal ignored; backspace right
  after a dot removes the digit before it; select a range and type over it; the Listo key;
  blur completes "2.000,5" to "2.000,50".
- [ ] If your iPhone's Region is the United States (the pad shows "."), "." types the
  decimal comma; typed fast after "3000" it still gives "3.000,5".
- [ ] Paste (long-press → Pegar) into an empty Monto: "1.234,56" and "1,234.56" both give
  1.234,56; "1.000" gives 1.000; **"1,000" is refused**: the field keeps its value and a
  note under it reads «No se pegó «1,000»: puede leerse de dos maneras. Escribí los
  decimales con «,».»; the next digit you type clears the note. With VoiceOver on, the
  note is announced.
- [ ] Paste "US$ 12.30" into an ARS account: it is refused with a currency-mismatch note, keeping the old amount without conversion. "ARS 1.234,56" on an ARS account and "US$ 12.30" on a USD account are accepted. A bare "$" is not proof of a particular currency.
- [ ] Save a gasto, a transfer, a budget, a recurring rule and a balance correction typed
  with decimals: detail, Movimientos and Inicio show exactly what you typed; edit one and
  the form prefills the same amount.
- [ ] *Changed:* the date wheel (Fecha → sheet) shows Spanish month names even if the
  iPhone is in English.
- [ ] *Changed:* VoiceOver on a Presupuestos row and the general budget card now says
  "pesos"/"dólares" instead of reading "$". Other VoiceOver amounts read as before.
- [ ] Amounts on every screen (Inicio, Movimientos, Reportes, Presupuestos, Tarjetas,
  Deudas, Recurrentes, Cuentas, details, the entry form's balance line) look as before;
  "$" and "US$" never end up on a different line than their number.
- [ ] Largest Dynamic Type: the amount field and the heroes are not cut; rows stack.

**B. Preview run** (only on FinanzApp Dev, never in a TestFlight or store build):
`EXPO_PUBLIC_LOCALE_PREVIEW=1 npm run start:dev-client -- --clear`. Más now lists
English under Idioma and a Región row (Argentina · 22/9/2026 · 1.234,56, United States ·
9/22/2026 · 1,234.56).
- [ ] Try the four combinations (Español/English × Argentina/Estados Unidos): words
  follow Idioma; separators, numeric dates and the clock follow Región; an account's
  currency never changes.
- [ ] United States: pesos read "AR$", dollars "US$"; the amount field types 999 → 1,000 and
  999,999 → 1,000,000 with the caret steady; "," from an Argentine pad types the decimal
  point; pasting "1.000" is refused with the note, "1,000" gives 1,000, "1.234,56" gives
  1,234.56.
- [ ] Open Nuevo gasto, type 1234,5, put the caret after the 4, go to Más → Región →
  United States and come back: the field reads 1,234.5, the caret is still after the 4,
  typing 9 gives 12,349.5; save: the movement is 12.349,50 when you switch back.
- [ ] VoiceOver in each combination on a movement row, an Inicio hero and a budget: the
  number is read correctly (English voice: "one thousand two hundred thirty-four point
  five six"). **Record** whether a Spanish voice reads "1.234,56 pesos" correctly with an
  iPhone Region of Estados Unidos (or a Spanish-US/Mexico voice): 23.1C2 decides from it.
- [ ] Date wheel with English + Argentina and Spanish + United States: month names in the
  interface language; **record** the column order iOS shows (it is iOS's choice).
- [ ] Backups: export and import in the United States region; the review shows counts and
  the export date in US format and imports nothing twice.
- [ ] ~~Stop Metro, restart without the flag (run A): the app is back to Spanish · Argentina
  whatever you chose in the preview~~ (superseded by 23.1C2: English and the United States
  are released, so a choice made in the preview now applies); no movement changed.

## Producto 23.1B2 — translation of the remaining screens (pending device review)

No native change: the installed **FinanzApp Dev** runs this PR from Metro (`git pull`,
`npm install`, `npm run start:dev-client -- --clear`, reload); Expo Go works too. English
is still **not** released: on the iPhone everything must read exactly as before, in
Spanish. Share a private backup first.

- [ ] Más footer reads "Producto 23.1B2" and still ends with the material and "Idioma:"
  diagnostics in Spanish (e.g. "Liquid Glass · Idioma: módulo nativo").
- [ ] Más: section titles, Finanzas rows with their counts ("2 tarjetas", "1 deuda"…), App y
  datos rows, Idioma screen — same text as before.
- [ ] Reportes: header, Pesos · ARS / Dólares · USD, month arrows, change vs last month,
  trend and donut captions, VoiceOver on a bar and a slice, budgets, merchants, insights
  ("Restaurantes superó…"), the day list "N gastos", category / day / comparison screens.
  A day with one expense now reads "1 gasto registrado" (grammar fix).
- [ ] Tarjetas: list, carousel VoiceOver ("Tarjeta 1 de 2"), card detail (Cierre,
  Vencimiento, "Resumen abierto desde…", purchases/payments counts), Pagar tarjeta: the
  payment screen title, "Pagar total", the default note ("Pago Visa"), the saved payment.
  Nueva/Editar tarjeta form, validation (closing day 0 → message), Archivar alert.
- [ ] Deudas y cobros: list sections Debo / Me deben, a debt detail, Registrar pago and
  Registrar cobro (title, default note, locked side reads "Debo · Juan"), Movimientos row
  "Caja → Debo · Juan", the transfer detail Desde/Hacia, the debt form and its alert.
- [ ] Cuentas: list, account detail (Gastado este mes, Recurrentes "N activos"), Nueva
  cuenta, Editar cuenta and the balance-correction alert text.
- [ ] Presupuestos: month header and arrows, overall card, category rows, "Por categoría"
  caption, VoiceOver sentences, the form (Pesos · ARS / Dólares · USD), Eliminar alert.
- [ ] Recurrentes: sections (Próximos 30 días, Activos, Pausados), frequency words,
  "En N días", pause/resume VoiceOver, the form and its past-date message.
- [ ] Categorías: list with counts, a built-in (Comida) and a custom one, edit a built-in
  and save only a new colour: the name stays "Comida" and nothing else changes; icon and
  colour names in the picker; archive/restore; "Ya existe una categoría llamada «…»".
- [ ] Copia de seguridad: export sheet texts, import review rows and counts, the conflict
  message (one record reads "Hay 1 registro…"), the too-large file message. Export a
  backup and import it again: nothing is duplicated.
- [ ] Asistente: title, suggestions, composer placeholder and voice affordance, the
  disconnected note, a draft card (Confirmar / Editar / Descartar) if the fixture build
  is used, evidence links "Ver movimientos / categoría / presupuesto".
- [ ] A built-in category you renamed (if any) shows its new name in Reportes → budgets and
  insights, like in Presupuestos (deliberate consistency fix).
- [ ] Errors in Spanish as before (future date in a recurring rule, duplicate category).
- [ ] Largest Dynamic Type, light and dark, Reduce Transparency and Reduce Motion: no new
  truncation or overlap on the screens above; VoiceOver reads the same sentences.
- [ ] No account, card, debt, movement, budget, rule or category changed.

## Producto 23.1B1 — translation of navigation, Inicio, Movimientos and forms (pending device review)

No native change: the installed **FinanzApp Dev** runs this PR from Metro. From
`apps/mobile`: `git pull`, `npm install`, `npm run start:dev-client -- --clear`, reload.
Expo Go works too. English is **not** released, so on the iPhone this PR must look
exactly like 23.1A in Spanish; the English layout is checked by tests only until 23.1C.

- [ ] Más footer reads "Producto 23.1B1".
- [ ] (Tab list superseded by decision 005, 2026-09-30: four tabs, no Asistente tab — see 24UX6A.) Tab bar: Inicio, Movimientos, Asistente (centre), Reportes, Más; header buttons
  "Ver mis cuentas" (Inicio) and "+" (Movimientos) read the same with VoiceOver.
- [ ] Inicio: Gastos / Disponible switch, month name, "Saldo registrado" with its ⓘ help
  alert, "N cuentas", Presupuesto del mes card ("te queda" / "excedido", "de $ … · N %",
  "N categorías en orden"), En qué gastaste (VoiceOver "Comida, …, 30 % del gasto del
  mes"), Próximos compromisos ("Hoy", "Mañana", "En N días"), Últimos movimientos, the
  four quick actions. Same text, same layout as before.
- [ ] Movimientos: search field and placeholder, Todos / Gastos / Ingresos / Transf.,
  "N movimientos", day headers (Hoy · 23 sep, Ayer · …), the day net and its VoiceOver
  ("Neto del día …"), "Sin coincidencias" with Limpiar filtros, and the empty state on a
  fresh install (do not delete data for this; skip if not possible).
- [ ] Rows: category names (Comida, Supermercado, a custom category, a renamed one)
  exactly as before; "Hoy", "Ayer", "Anteayer", "13 jul"; transfers "Caja → Banco".
- [ ] Movement detail and transfer detail: titles, status line, rows, budget line,
  Deshacer / Recuperar alerts (read the whole message, then Cancelar), Editar buttons.
- [ ] Nuevo movimiento: Gasto / Ingreso / Transferencia; Pagado con / Ingresa en,
  Comercio o concepto "Ej. Carrefour", the category sheet ("Buscar o crear categoría",
  typing a new name shows "Usar «…»"), Fecha, "Guardar gasto · $ …". Pick a card:
  the card glyph (not the wallet) in the selector and in the sheet.
- [ ] Transfer form: Desde / Hacia, "Usar todo", "Nota (opcional)", "Caja después",
  negative-balance warning. From Tarjetas → Pagar: "Pagar total", "Registrar pago".
- [ ] Errors still read in Spanish: choose a future date (Elegí hoy o una fecha
  anterior…), and try a card payment above the debt (El pago supera la deuda…).
- [ ] Leave a half-typed movement open, go to Más → Idioma, change the choice, come back:
  the draft is intact and the header title is unchanged.
- [ ] Largest Dynamic Type, light and dark, Reduce Transparency and Reduce Motion: no
  new truncation or overlap on the screens above.
- [ ] No account, card, movement, budget or rule changed; a new backup restores the same
  data.

## Producto 23.1A — language and region architecture (pending device review)

No native change: the **installed FinanzApp Dev** (the build rebuilt for 23.0 with
expo-localization) runs this PR from Metro. From `apps/mobile`: `git pull`, `npm install`
(adds a test-only dev dependency), `npm run start:dev-client -- --clear`, open FinanzApp
Dev and reload. Expo Go works too (`npm start -- --clear`). Share a private backup first.

- [ ] Más footer reads "Producto 23.1A" and still ends with "Idioma: módulo nativo".
- [ ] Más → App y datos: rows Copia de seguridad, Movimientos deshechos, **Idioma**
  (language glyph, subtitle "Español · según el dispositivo"); there is **no Región row**
  (it arrives in 23.1C). Idioma closes the group (no separator below it) and Movimientos
  deshechos now has one.
- [ ] Tap Idioma: a pushed screen titled "Idioma" with a native back swipe; one grouped
  list "Según el dispositivo / Ahora: Español" (checkmark) and "Español"; **no English
  option**, not even greyed out; the footnote says Spanish is the only language for now
  and that the setting does not change movements, accounts or backups.
- [ ] Tap Español: the checkmark moves, one selection tick, nothing else on screen or in
  the app changes; back in Más the subtitle reads "Español". Tap it again: no tick.
- [ ] Force quit and reopen: Idioma still reads "Español". Choose "Según el dispositivo",
  force quit, reopen: "Español · según el dispositivo".
- [ ] With the iPhone set to English (Settings → General → Language & Region), reopen
  FinanzApp: the whole app is still in Spanish, "Según el dispositivo" says "Ahora:
  Español" (English is not released). Set the iPhone's Region to United States: the app
  still writes "$ 1.234,56" and "22 sep 2026" (the US region is not released). Put the
  iPhone back to your usual settings.
- [ ] Leave a half-typed amount in Registrar gasto and a message in the Asistente, go to
  Más → Idioma, change the choice, come back: the draft and the conversation are
  intact, the tab and screen are the same.
- [ ] Idioma row and screen at the largest Dynamic Type sizes (titles and subtitles wrap
  to two lines, the checkmark stays visible), with VoiceOver ("Según el dispositivo,
  Ahora: Español, seleccionado, botón"), in light and dark, with Reduce Transparency and
  Reduce Motion on.
- [ ] No account, card, movement, budget or rule changed; a backup exported afterwards
  contains no language or region field.

## Producto 23.0 — interaction polish and localization foundation (pending device review)

Expo Go already contains `expo-localization`: stop Metro, run `npm start -- --clear` from
`apps/mobile`, reload. FinanzApp Dev needs a **new development build** to contain the
native module (commands in `apps/mobile/README.md`, profile `development`, bundle
identifier `com.facur3.finanzapp.dev`; FinanzApp Preview is not rebuilt or touched).

- [ ] **Old FinanzApp Dev (built before this PR), before rebuilding:** `npm run
  start:dev-client -- --clear`, open the app: no red screen and no "Cannot find native
  module 'ExpoLocalization'" in the app or in the Metro terminal; the app starts in
  Spanish; Más footer ends with "Idioma: Intl (sin módulo nativo)".
- [ ] **New FinanzApp Dev (rebuilt with this PR):** the app starts, Más footer ends with
  "Idioma: módulo nativo" (proof the binary links expo-localization); the app still
  reads Spanish on an English iPhone (English is not released); all data intact.
- [ ] **Expo Go:** Más footer ends with "Idioma: módulo nativo" as well.

- [ ] Más footer reads Producto 23.0; no account, card, movement, budget or rule changed
  after updating (share a private copy first).
- [ ] Nueva cuenta → Moneda: one row reading "Moneda" over "Pesos argentinos" over
  "ARS · $"; tap it, choose Dólares: the row reads "Dólares estadounidenses" with
  "USD · US$" on its own line, the amount symbol becomes US$, one selection tick. At the
  largest Dynamic Type sizes and on a narrow iPhone the name wraps and the code keeps a
  whole line; the chevron stays visible; both themes. VoiceOver reads "Moneda: Dólares
  estadounidenses, USD · US$".
- [ ] Editar cuenta: the same currency row, read-only (no chevron, nothing happens on tap).
- [ ] Amount field (Registrar gasto): type 9, 9, 9, 9 slowly and then fast: the "$" never
  moves; "999" becomes "1.000" with the "1" staying where the first "9" was; continue to
  "999.999" → "1.000.000"; the caret stays after the last digit; nothing jumps or fades.
- [ ] Amount field: type "1234,5", then tap between "2" and "3" and type "9" ("12.934,5"),
  backspace over the grouping dot (removes the digit before it), paste "2.000.000,50"
  and "2,000,000.50" (both read 2.000.000,50), switch the account to a USD one: only the
  symbol changes to US$. With 13 whole digits the size steps down and the whole amount
  stays visible; at the largest Dynamic Type the field still shows the whole amount or
  scrolls, never clips.
- [ ] Amount field with Reduce Motion on and off: identical behaviour (nothing animates).
- [ ] Presupuestos (general budget), Cuenta detail, Tarjetas, a card detail, Recurrentes
  (Próximos 30 días) and Deudas totals at the largest Dynamic Type: the statistics stack
  one under the other and every amount and date is whole; at the default size they sit
  side by side as before.
- [ ] Movimientos filter (Todos / Gastos / Ingresos / Transf.), the form's Gasto /
  Ingreso / Transferencia switch and the Pesos · ARS / Dólares · USD switches at the
  largest Dynamic Type: labels fit their segment (slightly smaller), never "…".
- [ ] Inicio with two currencies at large text: the Gastos / Disponible control and the
  ARS / USD control stack vertically instead of squeezing.
- [ ] Long names at the default text size: an account "Cuenta sueldo Banco de la
  Provincia de Buenos Aires" and a merchant of 60 characters in Movimientos, Cuentas,
  Recurrentes, Inicio (categorías y próximos pagos), Reportes → comercios and
  categorías, Deudas and Categorías wrap to two lines while the amount stays whole on
  the right and never overlaps the name; the third line is cut with "…" only on the
  name, never on the amount.
- [ ] Long amounts at the default text size: an expense of $ 999.999.999,99 and one of
  $ 9.999.999.999.999,99 (13 digits) in the same rows. On an iPhone 14 Pro the nine-digit
  amount sits beside the name at full size and the 13-digit one moves under the name,
  left-aligned, whole; on an iPhone SE / 13 mini (375 pt) both move under the name. A
  −US$ 999.999.999,99 transfer inside an account does the same. No amount is ever
  shrunk below its neighbours' size or cut.
- [ ] Large text: every row above stacks (amount under the name), whatever the amount.
- [ ] Reportes: the eyebrow "Gastado · ARS", Tarjetas "Saldo pendiente · ARS",
  Recurrentes "Pagos · ARS" and the day header net amount never break between the words
  and the code or number. *(Superseded by 24UX6E: Recurrentes reads «Gastos · ARS».)*
- [ ] Reportes budget rows: name over "spent de limit", the percentage on the right; a
  long category name wraps rather than truncates.
- [ ] Transfer preview rows ("Banco después / ARS 1.234,56") stack when the name is long;
  the code and the amount stay together.
- [ ] Dates: the entry form's date row reads "22 sep 2026" (the ledger abbreviation, not
  the device's "sept"); entry and transfer details read "martes, 22 de septiembre de
  2026"; Reportes and Presupuestos read "septiembre de 2026"; Copia de seguridad →
  Importar shows the export date as "22/9/2026, 14:03".
- [ ] Device in English: the app still reads Spanish everywhere (English is not released).
- [ ] Not fixed, observe and report: the credit card face at the largest text sizes
  (fixed aspect ratio) and the donut's centre label in Reportes.

## Producto 22.1 — UI clarity and form polish (pending device review)

- [ ] Más footer reads Producto 22.1. Más → Finanzas: each row shows the tile, the title in bold and the description under it; "Deudas y cobros / Debo · me deben" and "Tarjetas / Compras y resúmenes" never share a line or clip; App y datos rows show neutral glyphs; at the largest Dynamic Type sizes titles and descriptions wrap to two lines and the chevron stays visible; both themes.
- [ ] Reportes (with a ready month): "Comparar con el mes anterior" shows "Diferencias por categoría" underneath, no short wrapped lines on the right; it opens the comparison.
- [ ] Más → Copia de seguridad: "Importar copia / Revisar el archivo antes de agregar" as one row; it opens the review flow.
- [ ] Nueva cuenta: Nombre, the picker, then a "Moneda" row reading "Pesos argentinos · ARS" (or USD when opened from a USD context); tapping it opens a sheet with the two currencies and a checkmark; choosing Dólares ticks once and the row and the amount symbol update before saving; under Saldo inicial one line "Opcional. No cuenta como ingreso." with an ⓘ that opens the full explanation; VoiceOver reads "Más información sobre saldo inicial"; on a small iPhone the form scrolls with the keyboard open and Guardar stays reachable.
- [ ] Editar cuenta: the short notes under Saldo registrado and Moneda, each with an ⓘ; the currency row still cannot be changed.
- [ ] Empty states (Recurrentes, Tarjetas, Deudas without data): one calm card with a 44 pt glyph, not a tall block.

## Producto 22 — AI reachability and native material (pending device review)

> Superseded by decision 005, 2026-09-30: the five tabs with the Asistente in the centre, the Asistente tab and its composer resting on
> the tab bar no longer exist. The current shell, hub and Assistant checks are in the 24UX6A section at the top; the
> items below stay as the historical record of Producto 22.

- [ ] Before updating, share a private copy. After updating, Más footer reads Producto 22; no account, card, movement, budget or rule changed.
- [ ] The tab bar reads Inicio, Movimientos, Asistente, Reportes, Más; the centre sparkles icon fills when active; 30–40 tab changes through Asistente do not reproduce the black-tab issue.
- [ ] Hold the phone in one hand, right thumb then left thumb: the Asistente tab is reached without shifting the grip; compare with the leftmost Home action.
- [ ] Inicio → Asistente lands on the tab (the tab highlights; no back button, no stacked copy); typing there, switching to Inicio and back keeps the conversation; closing the app clears it.
- [ ] Más → Finanzas shows Cuentas, Tarjetas, Presupuestos, Recurrentes, Deudas y cobros, Categorías with six distinct restrained tiles; Tarjetas opens the same cards screen with "+" in its header, the carousel, Registrar compra and Pagar tarjeta work as before; saving a new card returns to Tarjetas.
- [ ] **Worklets retest (2026-09-22):** no native change, so no rebuild: stop Metro, run `npm start -- --clear` (bundler cache only), reload the project in Expo Go. No red screen and no "[Worklets] Tried to synchronously call a Remote Function" at startup; the Asistente tab opens, tapping the field raises the keyboard and the composer follows it exactly; dismissing it interactively follows the drag; the composer rests on the tab bar afterwards.
- [ ] **Startup, mode A (diagnostic):** from `apps/mobile` run `EXPO_PUBLIC_DISABLE_GLASS=1 npm start -- --clear`, scan the new QR. Expo Go loads and stays open; Inicio shows the four opaque circles (white with hairline in light, surface step in dark, cobalt wash and ring on the Assistant); Más footer reads "Material opaco (desactivado)".
- [ ] **Startup, mode B (automatic):** stop Metro, run `npm start -- --clear`, scan again. Expo Go loads and stays open with the same opaque circles and composer; Más footer reads "Material opaco (Expo Go)". Both modes: switch tabs 30–40 times through Asistente, open Más → Tarjetas, come back.
- [ ] If Expo Go still closes in either mode: note which mode, keep the Metro terminal output, and on the Mac/PC capture the crash log from the iPhone (Settings → Privacy & Security → Analytics & Improvements → Analytics Data, the newest `Exponent-…ips` file) or with `xcrun devicectl device info crashes` / Console.app filtered on "Exponent"; the first lines after "Application Specific Information" name the fatalError. Share only the crash text, never financial data.
- [ ] Glass itself (native Liquid Glass on the circles and the composer, the cobalt wash without ring, the 0.97 press with the glass visible, the Reduce Transparency switch flipping to opaque without a restart) is verified on the development build, not in Expo Go: there the footer must read "Liquid Glass".
- [ ] Composer in the Asistente tab: with the keyboard down the pill sits just above the tab bar with no empty strip; tap the field: the pill rises to the keyboard's top edge exactly; interactive dismiss follows the drag; large text still caps the field at about five lines.
- [ ] VoiceOver: the tab reads "Asistente"; Home actions read "Abrir el Asistente", "Registrar gasto", "Registrar ingreso", "Transferir entre cuentas"; the composer reads "Mensaje para el Asistente", "Dictar", "Enviar".
- [ ] Narrow width (SE / 13 mini if available) and the largest Dynamic Type: four columns still fit, captions wrap to two lines, no overlap between circles.

## Producto 21 — Assistant experience (pending device review)

- [ ] Before updating, share a private copy. After updating, Más footer reads Producto 21; no account, movement, budget or rule changed.
- [ ] Inicio shows four round actions in one row — Asistente, Gasto, Ingreso, Transferir — with equal columns on the iPhone 14 Pro; check a narrow width if available (SE / 13 mini) and Dynamic Type at the largest accessibility sizes: captions may wrap to two lines, nothing overflows, VoiceOver reads "Abrir el Asistente", "Registrar gasto", "Registrar ingreso", "Transferir entre cuentas".
- [ ] The material: white circles with a hairline edge and a soft shadow in light; a surface step with a faint light edge in dark; the Asistente circle on a cobalt wash with a thin cobalt ring and the sparkles glyph. Press: the 0.97 scale on touch (no scale with Reduce Motion), no flash.
- [ ] Asistente pushes the conversation screen (native back swipe works). Empty state: "¿En qué te ayudo?" and four suggestions; the composer sits above the home indicator; no "Nuevo chat" button yet.
- [ ] Tap the field: the keyboard rises and the composer follows it exactly (no gap, no jump); drag the list down to dismiss the keyboard interactively and the composer follows the drag; rotate large text on: the field grows to about five lines then scrolls inside.
- [ ] Send is grey and inactive while the field is empty or only spaces; typing fills it cobalt; the microphone shows the development-build note instead of recording.
- [ ] Send a message in this build: one light haptic, the text returns to the field untouched, one note "El Asistente todavía no está conectado…" appears in the thread and the caption under the composer is not repeated; nothing is sent (Airplane mode changes nothing).
- [ ] Optional test view: start Metro with `EXPO_PUBLIC_ASSISTANT_FIXTURES=1 npm start`. The amber "Vista de prueba" banner is visible. "¿Por qué gasté más este mes?" streams word by word with "Pensando…" first; Stop during streaming keeps the partial text and says "Respuesta interrumpida."; the answer shows four evidence rows and "Ver movimientos" opens Movimientos.
- [ ] Test view: "Gasté 18.500 en Carrefour con la Visa" (with an ARS account whose name contains "Visa") shows the draft card with amount, Comercio, Categoría tile, Pagado con tile and "Hoy"; Confirmar shows the test-view note and writes nothing (Movimientos unchanged); Editar opens Registrar gasto prefilled with 18.500,00, Carrefour, Supermercado and the account; Descartar collapses the card.
- [ ] Test view: "Gasté 18 mil en el súper" with two or more ARS accounts asks "¿Con qué lo pagaste?" with the accounts as chips; picking one ticks once, repeats the choice as your message and shows the draft; with exactly one ARS account the draft appears directly.
- [ ] Test view: "error", "sin conexión" and "límite" show one calm note each; "Reintentar" appears only for the ones that were sent.
- [ ] Scroll up while a long answer streams: the list does not pull you back down; at the end it follows. Reduce Motion on: messages fade in without rising, the thinking dot does not pulse, scrolling is not animated.
- [ ] VoiceOver: reads "Vos: …" for your messages, "Asistente: …" for answers, the draft rows as "Comercio: Carrefour" etc., the chips by name, "Enviar", "Dictar", "Detener respuesta", "Nuevo chat".
- [ ] Nuevo chat clears the thread and returns to the suggestions; leaving the screen and returning starts empty (no history in this build).

## Producto 20 — account identity and custom categories (pending device review)

- [ ] Before updating, share a private copy. After updating, Más footer reads Producto 20; every account keeps its name, currency and balance and shows the wallet-on-cobalt tile; every movement, budget and recurring rule is unchanged; the existing test categories still appear on their movements.
- [ ] Más → Finanzas: Cuentas, Presupuestos, Recurrentes, Deudas y cobros and Categorías each show a soft tinted tile; rows and text stay neutral; App y datos rows are unchanged; both themes.
- [ ] Nueva cuenta: Nombre, then the picker (preview, Icono grid, Color dots), Moneda, Saldo inicial; choosing a tile or a dot ticks once and shows the selection at once; the preview follows the name; with Reduce Motion nothing animates; VoiceOver reads "Banco", "Celeste" and "Vista previa: Banco en Celeste".
- [ ] Save "Cocos · billetera · cobalto", "Efectivo · efectivo · verde", "Banco Galicia · banco · celeste": Cuentas shows each tile; account detail, Registrar gasto → Pagado con, its sheet, Transferir → Desde / Hacia, Nuevo recurrente and the movement/transfer detail rows all show the same tile per account; cards keep the card glyph.
- [ ] Editar cuenta: change only the colour and save: the balance, the name and Movimientos deshechos are untouched and no correction is recorded; change name + icon: one save; change the balance: the confirmation still appears; currency cannot be changed.
- [ ] Más → Categorías → +: create "Kiosco" (gasto, café, ocre); it is offered immediately in Registrar gasto; saving a movement with it shows the tile everywhere.
- [ ] Edit "Comida" to "Alimentación" with a new colour: old movements read "Alimentación", a new movement recorded with it, Reportes shows one group with both, the budget and recurring rule for Comida still match; the categories list says "Predeterminada · editada".
- [ ] Archive a test category (e.g. "sjsjn"): it disappears from the picker for new movements, its movements still show it, it sits under Archivadas, editing one of those movements still shows it as the current value; Desarchivar brings it back.
- [ ] Creating a category named like an existing one ("comida") is refused with a message; nothing is saved.
- [ ] Copia de seguridad: share a v8 file; import it into a fresh install: accounts arrive with their looks and categories with their looks; importing an older v7 copy still works and its accounts show the default look.
- [ ] Large text, VoiceOver on the categories list and picker, both themes, Expo Go; long account and category names truncate inside their rows.

## Producto 19 — general monthly budget and category sublimits (pending device review)

- [ ] Before updating, share a private copy. After updating, Más footer reads Producto 19 and every existing budget is still there in Presupuestos with the same category, month, currency and amount (they are now "Por categoría" sublimits); nothing else changed.
- [ ] Más → Presupuestos → + : the form asks Tipo [General | Por categoría] first, then ARS / USD and the amount; General shows no category picker and explains it is the ceiling of all recorded expenses; Por categoría shows the picker and says it is a sublimit that does not add to the general budget; the amount field behaves exactly as in Interfaz 17.
- [ ] Create a general budget for this month: the screen leads with "Presupuesto general" (Disponible, bar, Gastado / Límite, "N % utilizado", Editar); the sublimits sit under "Por categoría" with their count; there is no summed total anywhere.
- [ ] Creating a second general budget for the same month and currency is refused with a clear message and nothing is saved; a general budget for the other currency or another month is allowed; ARS spending never counts against a USD budget.
- [ ] The general budget counts every recorded expense of the month (cash and card purchases once) and ignores income, transfers between accounts, Pagar tarjeta and debt payments/collections; undoing a movement lowers it.
- [ ] States: below 85 % neutral; from 85 % to exactly the limit amber ("cerca del límite" / "límite alcanzado"); past the limit coral with "excedido" and the amount over. Same colours on Home, Presupuestos, Reportes and the movement detail.
- [ ] Without a general budget: a compact "Agregar presupuesto general" secondary button, no giant empty card, sublimits still listed; with no budgets at all, the empty state with Crear presupuesto.
- [ ] Home "Presupuesto del mes": with a general budget it shows what is left, "de $X · N %" and how many sublimits are over; without one it shows the tightest sublimit and the count; tapping opens Presupuestos.
- [ ] Editing a general budget changes only the amount (no Tipo / currency controls); Eliminar asks first and archives it; a new general budget can then be created for that month.
- [ ] Reportes → Presupuestos lists "Presupuesto general" first; "Para tener en cuenta" shows "Superaste / Estás cerca de tu presupuesto general" when true.
- [ ] Más → Copia de seguridad: Compartir copia produces a v7 file; importing it into a fresh install (review, then confirm) restores the general and category budgets; an older v6 copy still imports and its budgets appear as category sublimits.
- [ ] VoiceOver reads the general panel as one sentence (spent of limit, percent, disponible / excedido); large text and Reduce Motion; both themes; Expo Go.

## Producto 18 — navigation and smart actions (pending device review)

- [ ] Más footer reads Producto 18; no data changes after updating; the tab bar reads Inicio · Movimientos · Reportes · Tarjetas · Más with the ellipsis-circle glyph; no sixth tab. (Tab list superseded by Producto 22, then by decision 005, 2026-09-30: four tabs, see 24UX6A.)
- [ ] Más shows two groups, Finanzas (Cuentas, Presupuestos, Recurrentes, Deudas y cobros, Categorías) and App y datos (Asistente "Vista previa", Copia de seguridad, Movimientos deshechos), each row opening its screen; counts match your data; Tarjetas is not a row.
- [ ] Copia de seguridad: Compartir copia opens the share sheet as before and Importar copia opens the review flow; cancelling the sheet reports nothing.
- [ ] Categorías lists the defaults and every category you typed yourself (e.g. your test ones) with their usage; nothing can be renamed or deleted; the ledger is unchanged afterwards.
- [ ] Tarjetas shows only cards: carousel, Saldo pendiente, Disponible / Cierre / Vencimiento, Registrar compra, Pagar tarjeta, Recientes; no "Deudas y cobros" section. Your debts are intact under Más → Deudas y cobros with the same balances.
- [ ] Home header shows only the accounts button; no sparkles. Home keeps the existing budget card and upcoming commitments only when there is data.
- [ ] Transfer: pick Desde; under the amount read "Saldo registrado: ARS …" with Usar todo; tap it: the field shows the whole balance formatted (e.g. 190.162, or 190.162,50 with cents) with the caret at the end, nothing is saved, Hacia still has to be chosen; change Desde to another account (and to USD): the figure and the fill follow; an account at $ 0 or negative shows the figure and no Usar todo; the saved transfer equals the filled value and the source ends at exactly zero.
- [ ] Pagar tarjeta: "Saldo pendiente: ARS …" with Pagar total; tap fills the balance due; editing above it is still refused on Registrar pago; editing below it is saved as one payment; no new expense appears in Movimientos or Reportes; a card without debt shows no Pagar total.
- [ ] Deuda (Debo): "Pendiente" with Saldar total fills the pending amount; Me deben: Cobrar total fills it; each save records one payment/collection, the pending amount reaches zero, and nothing appears as income or expense.
- [ ] VoiceOver reads the shortcut as "Usar todo, Saldo registrado: …" (and the equivalents); large text keeps the footnote and action on one or two lines without clipping; Reduce Motion unchanged; both themes; Expo Go.

## Interfaz 17 — visual identity and monetary experience (pending device review)

- [ ] Ajustes footer reads Interfaz 17; no data changes after updating.
- [ ] (Colour superseded by decision 005, 2026-09-30: Forest replaces cobalt.) The selected tab, the selected label of every segmented control, section links, "Este mes", the account selector and the picker checkmarks are the same cobalt blue in both themes; unselected tabs, other bars, dates and normal text stay neutral. Nothing reads as purple or neon.
- [ ] One filled blue button per screen (Guardar gasto, Guardar cambios, Crear, Registrar compra, Empezar); secondary actions stay grey; Pagar tarjeta and Transferir keep the azure transfer tint, distinguishable from the cobalt.
- [ ] Home "En qué gastaste": one grouped block of up to three rows; behind each row a faint, rounded, inset wash of its hue matches its share (a 99,8 / 0,1 / 0,1 % month shows one nearly full wash and two hairlines that are still tappable); the wash is never cut square by the surface edge and no separator crosses it; the section reads lighter than the recent-movements list; text stays readable over the wash in both themes; on first data the washes grow in with a slight stagger, on a currency change the block crossfades; with Reduce Motion the washes appear without growing; scrolling never moves them.
- [ ] Home quick actions: three neutral circles (surface step in dark, white with a soft shadow in light) with only the glyph coloured (Gasto coral, Ingreso green, Transferir azure); they no longer read as three coloured buttons.
- [ ] Category detail from Home ("Gastos del período") and from Reportes: the category tile, the full title (Comida, Supermercado, a long name) with no clipping at the top, the period line and the total; the day and comparison headers and "Límite mensual" render fully too.
- [ ] Amount field: typing 2, 20, 200, 2000, 20000, 200000, 2000000 reads 2 · 20 · 200 · 2.000 · 20.000 · 200.000 · 2.000.000; "2000,5" and "2000,50" read 2.000,5 and 2.000,50; on an en-US keypad the period acts as the decimal comma; backspace over a grouping dot removes the digit before it; deleting a digit in the middle keeps the caret where it was; pasting "2.000.000,50" and "2,000,000.50" both give 2.000.000,50; a third decimal is ignored; the field never jumps; the saved movement shows exactly the typed amount in ARS and USD.
- [ ] Amount field, stability: typing 3 · 30 · 300 · 3000 · 30000 · 300000 · 3000000 (quickly, and one key at a time) the number grows symmetrically around one fixed centre with no sideways jump or re-centring when a dot appears, the symbol slides smoothly beside it, the last digit and the caret are always fully visible, and the size only drops for 9.999.999.999.999,99 (ARS) or a full USD price; the same with the keyboard open and closed, in ARS and USD, and at the largest Dynamic Type.
- [ ] Amount field, correctness: fast repeated zeroes never produce a comma or a malformed group (3.000.008, 300,00); 3000000,5 and 3000000,50 read 3.000.000,5 and 3.000.000,50; backspace at the end walks back through the groups; backspace right after a dot removes the digit before it; tapping into the middle and typing keeps the caret after the typed digit while the dots move around it; typing over a selection works; a period typed on an en-US keypad becomes the comma; pasting 2.000.000,50 and 2,000,000.50 both give 2.000.000,50; the saved movement shows exactly the typed amount.
- [ ] Hero amounts on Home, Reportes, movement detail, card, debt, budgets and account detail: symbol slightly quieter, whole units dominant, cents quieter, one baseline, one line at the largest Dynamic Type; VoiceOver reads the whole amount once; row amounts unchanged.
- [ ] Reportes: the selected six-month bar and its label are blue, the others graphite; "Dónde más gastaste" shows rank number plus the merchant's category tile; "Para tener en cuenta" cards show a faint tint with fully readable text; Categorías / Día a día highlights in blue.
- [ ] Forms: category tile in its hue, account selector blue, date row neutral, the amount label and Listo bar in blue; the form stays calm.
- [ ] Both themes, Expo Go, large text and Reduce Motion for all of the above.

## Interfaz 16 — native visual cohesion and information hierarchy (pending device review)

- [ ] Ajustes footer reads Interfaz 16; no data changes after updating.
- [ ] Every category tile (Movimientos, Home, Reportes legend, Presupuestos, Recurrentes, detail) shows its glyph in the category hue on a soft tint of the same hue; no separate colour dot anywhere; income rows stay green; both themes remain readable.
- [ ] Home: Gastos / Disponible, the currency control, the month name and one number; no count, no date range, no week/month control. Disponible shows "Saldo registrado" with ⓘ and the account count only.
- [ ] Home round actions: Gasto (coral), Ingreso (green), Transferir (blue) each open the right mode of the movement modal; they scale on press and read well at large text.
- [ ] "En qué gastaste": up to three ranked rows with a thin hue line; "Ver N" opens Reportes; the block crossfades on currency change.
- [ ] Hero amounts: $ 0,00, $ 2.000,00, $ 200.000,00 and $ 4.006.331,00 render at full size on Home; $ 999.999.999,99 and US$ 999.999.999,99 stay on one line, clearly dominant (about 40 and 34 pt), never tiny, on Home, Reportes, movement detail, card, debt, budgets and account detail; the same at the largest Dynamic Type; row amounts never wrap; the amount field shrinks as digits are typed.
- [ ] Editar movimiento, Registrar gasto, recurring and budget forms show the chosen category on its own hue (Mascotas looks like Mascotas on the detail and in the selector); the picker sheet tiles match; the account selector turns blue once an account is chosen; the date row stays neutral.
- [ ] Home's category section action reads "Reportes".
- [ ] Long merchant, category and account names truncate or wrap inside their surfaces at default and largest Dynamic Type.
- [ ] Tarjetas and card detail: card → debt → three facts (Disponible with the limit caption, Cierre, Vencimiento) → Registrar compra → Pagar tarjeta (same width, blue tint) → activity with the statement caption; no detail table below.
- [ ] Cuentas, account detail, Presupuestos, Recurrentes, Deudas and the movement detail show no bank or rule-restating copy; the account detail uses the round actions.
- [ ] Changing tab ticks once and switches instantly; re-tapping the current tab does not tick.

## Interfaz 15 — motion system, Home composition and category colour (pending device review)

- [ ] Ajustes footer reads Interfaz 15; no data changes after updating.
- [ ] Segmented controls (Gastos / Disponible, Esta semana / Este mes, currency, Reportes views, Movimientos filters, form kind) slide one thumb to the chosen segment with a light selection tick; tapping the current value does nothing; a fast double switch reverses mid-slide without a jump.
- [ ] Nuevo movimiento: Gasto / Ingreso / Transferencia is one control above the form; choosing Transferencia finishes the thumb slide, ticks once and crossfades the form below with no screen swap; the chosen account carries over; Pagar tarjeta still opens its own locked form.
- [ ] Home: switching metric, period or currency crossfades the hero (old fades in 100 ms, new rises in 200 ms) and at most one other block; under Disponible the period row dims in place and nothing below moves; the composition bar re-proportions smoothly for the same categories and crossfades when the categories change.
- [ ] Full-width rows (Movimientos, Home lists, detail rows, pickers) tint on press and do not shrink; buttons and cards scale; icon and text buttons dim.
- [ ] Home shows the stacked composition bar and top three categories with a coloured dot; "Otras N categorías" opens Reportes; the Disponible ⓘ button opens the definition and no disclaimer copy appears on screen.
- [ ] Without recurring rules, no "Próximos compromisos" block exists on Home; with a rule it appears with "Ver todos".
- [ ] Reportes: the first donut sweeps clockwise from twelve; changing month (arrows, Este mes, a trend bar) crossfades the title, caption, total and donut together with no redraw; slice colours match the legend dots and Home's bar.
- [ ] Tarjetas: neighbouring cards step back while swiping; settling on another card ticks once, the panel's values crossfade and the Deudas section below does not jump; page dots transition.
- [ ] Choosing a category or account in a form ticks once; choosing the same one again does not.
- [ ] Reduce Motion on: no thumb slide, no hero rise, no section slides, donut appears finished, cards stay flat, screens and sheets fade instead of sliding; values still crossfade (opacity only); haptics still fire.
- [ ] Both themes at 60 and 120 Hz: no dropped frames while scrolling Home with the composition bar visible; large text keeps rows readable.

## Interfaz 14 — Presupuestos, Recurrentes and Cuentas polish (pending device review)

- [ ] Ajustes footer reads Interfaz 14; no data changes after updating.
- [ ] Presupuestos shows what is left (or how far over) as the hero, spent and limit, a status line, and one row per category with percentage, status and a thin bar; a category over its limit reads coral, near the limit amber.
- [ ] Month arrows label the month as en curso, cerrado or futuro; Este mes returns to today.
- [ ] Recurrentes shows Pagos / Vencimientos / Ingresos for the next 30 days per currency; rows show frequency, next date, account, signed amount and Hoy / Mañana / En N días.
- [ ] Pausing with the switch keeps the rule and its history; reactivating skips elapsed dates and never posts them.
- [ ] Cuentas lists only cash accounts, grouped by currency, each with its recorded total; the footer says cards and debts live in Tarjetas.
- [ ] An account shows its recorded balance, this month's expenses and income, Gasto / Ingreso / Transferir and Recurrentes; opening a card account from anywhere lands on the card.
- [ ] Light/dark, large text, VoiceOver and Reduce Motion remain readable on these screens.

## Interfaz 13 — Reportes analytics (pending device review)

- [ ] Ajustes footer reads Interfaz 13; no data changes after updating.
- [ ] Reportes shows the month title, the recorded total, "por día" and the change versus the same days of the previous month (or nothing when history is missing).
- [ ] The six-month bars use one scale; tapping a past month selects it and updates total, donut and lists; the current month bar is outlined.
- [ ] The donut has at most five named slices plus Otras, a 2 pt gap between slices and the total in the middle; slices match the legend order and swatches.
- [ ] Legend rows open the category's movements for that month; Día a día rows open that day.
- [ ] Presupuestos rows show spent of limit and a percentage (amber near the limit, coral when exceeded); Administrar opens Presupuestos for that month.
- [ ] Dónde más gastaste ranks merchants by amount with count and category; Para tener en cuenta lists only facts (over/near budget, largest expense, category that grew).
- [ ] Flujo neto equals recorded income minus recorded expenses; transfers and card payments are excluded.
- [ ] Dark mode, large text, VoiceOver (donut and bars announce values) and Reduce Motion (no fade/bar animation) remain readable.

## Interfaz 12 — entry, transfer and recurring form hierarchy (pending device review)

- [ ] Ajustes footer reads Interfaz 12; no data changes after updating.
- [ ] Registrar gasto shows Gasto / Ingreso / Transferencia, the large amount, then Categoría and Pagado con as full-width cards before the merchant field.
- [ ] Choosing a card in Pagado con shows "Tarjeta de crédito · deuda …"; choosing a cash account shows "Saldo registrado …"; the sheet names each option's kind and balance.
- [ ] With a budget for the chosen category this month, the Categoría card shows "… de … este mes" and turns amber near the limit or coral when exceeded; without a budget it shows nothing.
- [ ] Ingreso tints the amount green and relabels the account card to Ingresa en.
- [ ] The Save button echoes the typed amount; invalid text shows an error and keeps the draft.
- [ ] Tapping Transferencia opens the transfer form with the same account preselected; its Gasto / Ingreso options return to the entry form.
- [ ] Pagar tarjeta and Registrar pago/cobro keep the obligation as a fixed card with its debt or pending amount; only same-currency cash accounts are offered.
- [ ] Nuevo recurrente uses the same Categoría and Pagado con cards, then frequency and next date.
- [ ] Keyboard open, large text, VoiceOver ("Categoría: Elegir categoría") and Reduce Motion remain usable.

## Interfaz 11 — compact Home, Movimientos and transaction detail (pending device review)

- [ ] Ajustes footer reads Interfaz 11; existing data is unchanged (no schema change in this delivery).
- [ ] Inicio fits its first screen with the hero, Gasto/Ingreso and the budget line; there are no timeline bars on Inicio.
- [ ] Gastos / Disponible and ARS / USD sit in one row; Esta semana / Este mes appears only under Gastos.
- [ ] The hero amount stays readable at large text; the eyebrow shows the period dates.
- [ ] En qué gastaste shows at most three categories with amount and share; Reportes opens the Reportes tab with the same currency.
- [ ] Próximos compromisos shows Programar when empty and up to three rules with "Hoy / Mañana / En N días".
- [ ] Movimientos → Transf. lists only transfers, card payments and debt settlements; Gastos/Ingresos exclude them.
- [ ] Section labels read Hoy · 20 sep, Ayer · 19 sep, a weekday within the last week, then the date; older years include the year.
- [ ] A day with ARS and USD entries shows no net total; a single-currency day shows +/− net of entries only.
- [ ] A transaction detail shows amount, merchant, full date, status, category, account or card (opens the card) and, only with a matching budget, a Presupuesto row that opens that month.
- [ ] Transfer detail titles card payments, debt payments and collections and links both sides.
- [ ] Light/dark, large text, VoiceOver and Reduce Motion remain readable on Inicio, Movimientos and detail.

## Interfaz 10 — five tabs, cards/debts and the neutral visual system (pending device review)

Save a private backup first and use small test amounts. Do not uninstall the only copy.

- [ ] Ajustes footer reads Interfaz 10; accounts, movements, recurrentes and budgets are unchanged after the schema 5 → 6 upgrade.
- [ ] (Tab list superseded; current shell: decision 005, 2026-09-30, see 24UX6A.) Five tabs (Inicio, Movimientos, Reportes, Tarjetas, Ajustes) switch 30–40 times without a black frame; Reportes opens from Inicio → Reporte mensual on the tab.
- [ ] Inicio → Próximos compromisos → Programar opens the recurring form even with no rules; Ajustes → Recurrentes still works.
- [ ] The purple accent is gone: ink tab bar and buttons, blue links, coral/green only on semantic amounts and tiles, amber only for warnings.
- [ ] Tarjetas → + creates a card with name, currency, optional current debt, limit and closing/due days; it appears as a card face in the carousel.
- [ ] With two cards, the carousel snaps one card at a time and the panel below changes to the selected card.
- [ ] Registrar compra posts one expense on the card: Movimientos, Reportes and Presupuestos count it once; the card debt rises by the same amount; Disponible does not change.
- [ ] Pagar tarjeta only offers cash accounts in the card's currency, caps at the outstanding balance, lowers the cash balance and the card's balance due, and adds no expense or income.
- [ ] Card detail lists purchases and payments with "Pago de tarjeta · desde …" and links each purchase to its normal detail.
- [ ] A card purchase detail's Tarjeta row opens the card, not a generic account screen; Cuentas never lists card or debt accounts.
- [ ] Deudas → + creates "Debo" and "Me deben"; Registrar pago/cobro is capped at the pending amount and never appears as a gasto/ingreso.
- [ ] The expense form's Cuenta o tarjeta selector names cards as Tarjeta de crédito and never offers a debt.
- [ ] Exported v6 backup lists cards and debts on review; reimport adds nothing twice; an Interfaz 09 (v5) file still imports.
- [ ] Light/dark, large text (rows stack), VoiceOver labels for cards, amounts and status, and Reduce Motion (no carousel/bar animation) remain readable.

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

## Producto 24B5 — the currency screen and the precisions, on FinanzApp Dev with the preview gate

**Not done in 24B5: no EAS build was made and the iPhone was not touched.** These checks need a
development build of this commit **started with the preview flag** and the 24B4 checks passed first.

**How to enable the test currencies (development only, never a release):**
1. Install the development build (see Producto 24B4 above; keep a v8 backup first).
2. Start the bundler with the flag and a clean cache: `EXPO_PUBLIC_CURRENCY_PREVIEW=1 npm run
   start:dev-client -- --clear` (Metro caches compiled code without the value; `--clear` after
   changing it). Más must show, under the footer, "Monedas de prueba activas: EUR, GBP, JPY, CLP,
   KWD. Solo en esta compilación de desarrollo." If the line is missing, the flag did not reach the
   bundle: stop.
3. A release or preview build never shows that line and offers ARS and USD only (the flag is compiled
   away; `tests/currency-preview.node.ts`).

**Owner's report (2026-09-24):** the 24B5 tests were completed on the iPhone and PR #51 was merged;
the first finding (the date sheet almost empty, the wheel at the top) is fixed in Producto 24B6. The
per-item results below were not recorded, so the boxes stay open: the gate-opening commit waits for
them (the minimum set is listed in docs/mobile-roadmap-history.md, Producto 24B6 status).

**On the device (record each result here, es and en):**
- [ ] Cuenta nueva → Moneda opens the sheet with seven rows (name, code, symbol) and a search field;
  "yen", "japón", "€" and "840" find their currency; VoiceOver reads "Yenes japoneses, JPY" per row
  and "seleccionado" on the current one; Dynamic Type at the largest sizes wraps the names and clips
  nothing; Reduce Motion fades the sheet instead of sliding it.
- [ ] Choose JPY before typing: the amount field shows the number pad (no decimal key) and "JP¥";
  type 1500 → the account opens with 1.500 yen; Inicio shows "JP¥ 1.500"; VoiceOver reads
  "1500 yenes japoneses" / "1500 Japanese yen".
- [ ] Choose KWD: the decimal pad, three decimals ("1.234,567"); a fourth decimal is refused; Terminar
  pads to three; VoiceOver reads "1234,567 dinares kuwaitíes" / "1234.567 Kuwaiti dinars" as a
  fraction, never as thousands (the reason three-decimal currencies open last).
- [ ] Tarjeta, Deuda y Presupuesto: the currency control comes before the amount (a row that opens the
  sheet with seven currencies); switching currency with a draft typed keeps the digits and shows the
  kept-draft note when they no longer fit; Recurrente: the account above the amount.
- [ ] With a CLP account beside ARS, VoiceOver reads "pesos argentinos" (not "pesos") on Inicio and
  in the amount field; with only ARS/USD, the words of always.
- [ ] Copia de seguridad → Compartir copia gives a v9 file (`currencyUnits` with EUR, GBP, JPY, CLP,
  KWD); reinstall or clear the app, restore it: every amount and currency identical, Inicio's switch
  lists the seven currencies; restore it a second time: "nada nuevo para agregar".
- [ ] Stop the bundler without the flag and reopen: the forms offer ARS and USD only, the existing
  yen and dinar rows stay readable and editable, exporting still gives v9.

## Producto 24B4 — SQLite 9 and backup v9 (the one-way upgrade, on the owner's test data)

Nothing visible changes with ARS and USD beyond the Más footer ("Producto 24B4"), the "Copias
nativas v1 a v9" note and a review row that only a v9 copy shows. What the device must prove is
the migration itself. **Not done in 24B4: no EAS build was made and the iPhone was not touched.**

**Before installing anything (the owner's decision, AGENTS.md rule 3):**
1. The build to install is a development build of this commit (`eas build --profile development
   --platform ios`, the same profile as 23.1C2; the owner runs it and pays for it). Expo Go cannot be
   used: the migration runs inside the app's own SQLite file.
2. What happens to the existing data: on first launch the app opens the schema 8 file and, in one
   transaction, rebuilds `accounts` and `monthly_budgets` and creates `currency_units`, then sets
   `user_version = 9`. Every row keeps its bytes (the Linux test proves it on a real file with every
   table populated). If the migration fails, the file stays at schema 8 and the app shows the error
   without resetting anything. **After it succeeds, an earlier build refuses the file** ("Estos datos
   requieren una versión más nueva…"); going back means restoring a backup into a reinstall.
3. How to keep a copy: before installing, in the current build, Más → Copia de seguridad → Compartir
   copia, and save the JSON (v8) in Files or another private place; optionally also export from the
   new build afterwards (still v8 while only ARS/USD exist). Do not uninstall the app.

**On FinanzApp Dev, once installed:**
- [ ] First launch opens without an error; Más says Producto 24B4; Inicio, Movimientos, Reportes,
  Presupuestos, Tarjetas, Deudas and Recurrentes show the same figures as before the update.
- [ ] Record one expense, one transfer and one budget edit; close the app fully and reopen: the
  figures persist (schema 9 is read as is, nothing migrates twice).
- [ ] Copia de seguridad → Compartir copia: the file is v8 (no `currencyUnits` key) and, imported into
  the same app, shows "nada nuevo para agregar". Import the pre-update v8 copy: identical, nothing added.
- [ ] Interrupt a launch (force-quit during the first seconds of the very first open, before the
  migration is expected to finish) on a **copy** of the data only if such a copy exists; otherwise
  skip: the Linux tests cover the rollback.
- [ ] Reserved for stage 9 (a development build with a test gate): a JPY account, a v9 export with
  `currencyUnits`, restore into a fresh install, VoiceOver on the review row.

## Producto 24B3 — presentation and copy for every currency (nothing visible in production)

Nothing to verify on the device for 24B3 beyond the Más footer reading "Producto 24B3": with
ARS and USD every amount, label and VoiceOver sentence is byte-identical to 24B2 (goldens), and
the currency segments of Inicio, Reportes, Presupuestos and the card, debt and budget forms read
exactly as before. A regression spot-check: the balance-correction alert, the movement detail's
budget row and the transfer form's balances still show the region's separators; VoiceOver still
reads "1234,56 pesos" / "1234.56 dollars".

Reserved for stage 9, on a development build with a test gate that holds three or more
currencies (never on real data):
- [ ] The currency row on Inicio (bare code), Reportes and Presupuestos ("Yenes japoneses ·
  JPY"): 44 pt tap target, the sheet slides up (fades under Reduce Motion), a checkmark on the
  current currency, choosing one changes only the figures shown, nothing is converted.
- [ ] The sheet with six or more currencies: the search field focuses without covering the
  list, filters by code and name, clears on a choice; at the largest text sizes the rows wrap
  and nothing is cut at 320 pt (iPhone SE class).
- [ ] VoiceOver in Spanish and English: "1500 yenes japoneses" / "1500 Japanese yen",
  "1234,567 dinares kuwaitíes" / "1234.567 Kuwaiti dinars" (three decimals read as a fraction,
  not a thousands pattern), and with a CLP account beside ARS "pesos argentinos", with a CAD
  account beside USD "dólares estadounidenses" / "US dollars"; the amount field's name and the
  card face follow the same rule.
- [ ] The MonthBars scale caption in JPY and KWD, and "—" with "Importe fuera de rango" for a
  restored backup whose total leaves the safe range.

## Producto 24B2 — strict route currencies and the amount field by exponent (nothing visible in production)

Nothing to verify on the device for 24B2 beyond the Más footer reading "Producto 24B2":
with ARS and USD the amount field behaves exactly as in 23.1C1 (re-run the **Producto
23.1C1** amount-field checks if in doubt). Reserved for stage 9, on a development build with
a test gate: the number pad at exponent 0, the kept-draft note after switching an account
with a half-typed amount (the digits must not move; Save disabled; VoiceOver announces the
note), and the catalogue paste markers.

## Producto 24B1 — currency safety net (nothing visible; checks reserved for 24B stage 9)

Nothing to verify on the device for 24B1 beyond the Más footer reading "Producto 24B1".
Reserved for the development build of 24B stage 9, before any currency beyond ARS/USD opens:
- [ ] VoiceOver in Spanish and English reads a zero-decimal amount ("1.500 JPY") and a
  three-decimal amount ("1.234,567 KWD") unambiguously (no "1234,567" read as a
  thousands pattern); the singular for exactly one unit of a currency without decimals.
- [ ] The number pad at exponent 0 shows no decimal key; settle pads to the exponent.
- [ ] The currency picker at the largest text sizes and at 320 pt; Reduce Motion honoured.
- [ ] The currency-change notice on a kept draft.
- [ ] The upgrade of a real v8 ledger and a backup export/restore, on a copy (decision 7.6.5).

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
