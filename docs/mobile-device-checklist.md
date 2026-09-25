# Physical iPhone acceptance checklist

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
- [ ] **Assistant entry — prominence and ergonomics.** Reads as the most important control after the
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
- [ ] **Cobalt balance.** Count the cobalt on screen: the Assistant's glyph and edge, the active tab.
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
- [ ] The tab bar's inactive labels (secondary ink) in both themes: legible without competing with
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
  the card's currency only, "Pagar total" fills the recorded debt; saving lowers the cash balance
  and the card debt and adds no expense.
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
reads "Owed ARS 50.00", not "ARS Owed"; paying it all shows "Visa después: Sin deuda"), Reportes (the largest-expense insight shows the
day as 9/22 in the US and 22/09 in Argentina; "Compare with previous month"), Tarjetas
("Recorded debt", "Statement open since yesterday"), Deudas ("Due today"), Presupuestos,
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
- [ ] Tab bar: Inicio, Movimientos, Asistente (centre), Reportes, Más; header buttons
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
- [ ] Reportes: the eyebrow "Gastado · ARS", Tarjetas "Deuda registrada · ARS",
  Recurrentes "Pagos · ARS" and the day header net amount never break between the words
  and the code or number.
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
