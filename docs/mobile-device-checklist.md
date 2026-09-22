# Physical iPhone acceptance checklist

## Producto 22.1 — UI clarity and form polish (pending device review)

- [ ] Más footer reads Producto 22.1. Más → Finanzas: each row shows the tile, the title in bold and the description under it; "Deudas y cobros / Debo · me deben" and "Tarjetas / Compras y resúmenes" never share a line or clip; App y datos rows show neutral glyphs; at the largest Dynamic Type sizes titles and descriptions wrap to two lines and the chevron stays visible; both themes.
- [ ] Reportes (with a ready month): "Comparar con el mes anterior" shows "Diferencias por categoría" underneath, no short wrapped lines on the right; it opens the comparison.
- [ ] Más → Copia de seguridad: "Importar copia / Revisar el archivo antes de agregar" as one row; it opens the review flow.
- [ ] Nueva cuenta: Nombre, the picker, then a "Moneda" row reading "Pesos argentinos · ARS" (or USD when opened from a USD context); tapping it opens a sheet with the two currencies and a checkmark; choosing Dólares ticks once and the row and the amount symbol update before saving; under Saldo inicial one line "Opcional. No cuenta como ingreso." with an ⓘ that opens the full explanation; VoiceOver reads "Más información sobre saldo inicial"; on a small iPhone the form scrolls with the keyboard open and Guardar stays reachable.
- [ ] Editar cuenta: the short notes under Saldo registrado and Moneda, each with an ⓘ; the currency row still cannot be changed.
- [ ] Empty states (Recurrentes, Tarjetas, Deudas without data): one calm card with a 44 pt glyph, not a tall block.

## Producto 22 — AI reachability and native material (pending device review)

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

- [ ] Más footer reads Producto 18; no data changes after updating; the tab bar reads Inicio · Movimientos · Reportes · Tarjetas · Más with the ellipsis-circle glyph; no sixth tab.
- [ ] Más shows two groups, Finanzas (Cuentas, Presupuestos, Recurrentes, Deudas y cobros, Categorías) and App y datos (Asistente "Vista previa", Copia de seguridad, Movimientos deshechos), each row opening its screen; counts match your data; Tarjetas is not a row.
- [ ] Copia de seguridad: Compartir copia opens the share sheet as before and Importar copia opens the review flow; cancelling the sheet reports nothing.
- [ ] Categorías lists the defaults and every category you typed yourself (e.g. your test ones) with their usage; nothing can be renamed or deleted; the ledger is unchanged afterwards.
- [ ] Tarjetas shows only cards: carousel, Deuda registrada, Disponible / Cierre / Vencimiento, Registrar compra, Pagar tarjeta, Recientes; no "Deudas y cobros" section. Your debts are intact under Más → Deudas y cobros with the same balances.
- [ ] Home header shows only the accounts button; no sparkles. Home keeps the existing budget card and upcoming commitments only when there is data.
- [ ] Transfer: pick Desde; under the amount read "Saldo registrado: ARS …" with Usar todo; tap it: the field shows the whole balance formatted (e.g. 190.162, or 190.162,50 with cents) with the caret at the end, nothing is saved, Hacia still has to be chosen; change Desde to another account (and to USD): the figure and the fill follow; an account at $ 0 or negative shows the figure and no Usar todo; the saved transfer equals the filled value and the source ends at exactly zero.
- [ ] Pagar tarjeta: "Deuda registrada: ARS …" with Pagar total; tap fills the debt; editing above it is still refused on Registrar pago; editing below it is saved as one payment; no new expense appears in Movimientos or Reportes; a card without debt shows no Pagar total.
- [ ] Deuda (Debo): "Pendiente" with Saldar total fills the pending amount; Me deben: Cobrar total fills it; each save records one payment/collection, the pending amount reaches zero, and nothing appears as income or expense.
- [ ] VoiceOver reads the shortcut as "Usar todo, Saldo registrado: …" (and the equivalents); large text keeps the footnote and action on one or two lines without clipping; Reduce Motion unchanged; both themes; Expo Go.

## Interfaz 17 — visual identity and monetary experience (pending device review)

- [ ] Ajustes footer reads Interfaz 17; no data changes after updating.
- [ ] The selected tab, the selected label of every segmented control, section links, "Este mes", the account selector and the picker checkmarks are the same cobalt blue in both themes; unselected tabs, other bars, dates and normal text stay neutral. Nothing reads as purple or neon.
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
- [ ] Five tabs (Inicio, Movimientos, Reportes, Tarjetas, Ajustes) switch 30–40 times without a black frame; Reportes opens from Inicio → Reporte mensual on the tab.
- [ ] Inicio → Próximos compromisos → Programar opens the recurring form even with no rules; Ajustes → Recurrentes still works.
- [ ] The purple accent is gone: ink tab bar and buttons, blue links, coral/green only on semantic amounts and tiles, amber only for warnings.
- [ ] Tarjetas → + creates a card with name, currency, optional current debt, limit and closing/due days; it appears as a card face in the carousel.
- [ ] With two cards, the carousel snaps one card at a time and the panel below changes to the selected card.
- [ ] Registrar compra posts one expense on the card: Movimientos, Reportes and Presupuestos count it once; the card debt rises by the same amount; Disponible does not change.
- [ ] Pagar tarjeta only offers cash accounts in the card's currency, caps at the recorded debt, lowers the cash balance and the card debt, and adds no expense or income.
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
