/** The FinanzApp colour system, free of React Native so its contrast can be
 * checked in Node.
 *
 * Electric Lime (Producto 25VIS1, a palette trial on decision 005's structure): a mineral off-white ground in light
 * and a neutral near-black (never crushed #000) in dark, graphite ink for text and money, and one vivid
 * yellow-chartreuse brand in the 68–80° hue window, on the yellow side of a bright green and paired with ink, never
 * with a forest-green second brand. The lime is a field, not a tint: Inicio's financial header (`hero`), the dock's «+»
 * and the Assistant's circle (`accent`) and the filled call to action (`primaryFill`) carry it, always with ink on
 * it. Text can never be lime on a light ground, so the brand as text (`primary`, `link`, the selected choice, checks)
 * is a deep olive-lime in light and a softened lime in dark, so dark mode is not neon on black. Everything else, the
 * dock included, stays neutral graphite. Forest (24UX6A) was replaced token for token under the same names: no second
 * palette exists, and its values live in git history (master 227942c) should the owner revert the trial.
 * Glass is a control layer only, allowed on the dock, the «+», the capture hub,
 * compact circular controls, menus and the composer; this PR draws it on the
 * dock pill, the account detail's pills and the composer, and keeps the «+»
 * and the hub card solid. Rows, cards, balances, charts and sticky content
 * stay solid.
 *
 * Meaning never rides on colour alone and red never means "spent": on a typed
 * row an expense amount is ink without a sign, income is `income` (positive)
 * with a plus, a transfer a neutral slate (`transfer`) without a
 * sign (movement-amount.ts), and `expense` (negative) is kept for what is
 * destructive, overdue or over a limit. `warning` is due soon. Lime never means success, income, warning or alert:
 * `income` is a separate semantic green, well apart from the brand's hue. The category hues (category-color.ts,
 * @finanzapp/domain appearance) and the card faces (card-faces.ts) are separate families and are not changed by this
 * palette: a stored colour id and a historical category's derived hue keep their identity. */
export const lightPalette = {
  /** Canvas, surface (groups, sheets, fields), inset (chips and fields on a surface), elevated (selected segment, popovers). */
  background: '#F1F2EE', surface: '#FFFFFF', inset: '#E8E9E4', elevated: '#FFFFFF',
  /** Ink: primary text and money, secondary text and labels (7.0:1 on the inset), tertiary for decimals, placeholders
   * and glyphs (5.1:1 on the inset). */
  text: '#131411', secondary: '#4A4D46', tertiary: '#5E625A', line: '#DFE0DA',
  /** Brand text: links, the selected choice, active glyphs. A deep olive-lime (7.0:1 on white): lime itself cannot be text on light. */
  primary: '#4A6100',
  /** Brand fill: the filled call to action, Electric Lime with ink on it (14.1:1). */
  primaryFill: '#C6F12E', onPrimary: '#131411',
  /** A whisper of the brand for a tinted row or tile. */
  primarySoft: '#EEF5D6',
  /** The chosen segment of a compact segmented control on the canvas: white on the inset track. */
  thumb: '#FFFFFF',
  /** A quiet section link («Ver todos»): the brand text. */
  link: '#4A6100',
  /** A switch that is on: the brand text tone, so its white knob stays visible (7.0:1); lime would swallow it. */
  toggle: '#4A6100',
  /** Semantics. `expense` is the negative tone (destructive, overdue, over a limit), not ordinary spending. */
  /** `transfer`: a neutral slate (≈203°, low saturation), 6.6:1 on white, 5.4:1 on its tile. */
  expense: '#B3432E', income: '#1F7A4F', transfer: '#48606F', warning: '#9A5B00',
  expenseSoft: '#F7E6E1', incomeSoft: '#E2F1E8', transferSoft: '#E4EAEE', warningSoft: '#F7ECDB',
  /** Trailing swipe actions (24UX4): solid fills under a white label, each 4.5:1 or more. Destructive is the negative
   * tone, the reversible action a quiet grey, the forward action (pay, resume) the brand's deep olive-lime. */
  swipeDestructive: '#B3432E', swipeNeutral: '#5D6159', swipeAccent: '#4A6100',
  shadow: 'rgba(19, 20, 17, 0.08)',
  /** The dimming behind a sheet or the capture hub: the screen stays legible underneath. */
  scrim: 'rgba(0, 0, 0, 0.40)',
  /** Inicio's financial field (the lime hero) and what sits on it: ink (14.1:1), secondary ink (7.4:1), the fill of its
   * compact controls (the scope chip, the accounts button, the segmented track; ink 10.3:1 on it), and the chosen segment
   * (the light surface's white thumb with ink text, 18.5:1, 1.8:1 against the track). The field is light in both themes, so
   * the status bar over it is dark and the thumb is the same white in dark. */
  hero: '#C6F12E', heroInk: '#131411', heroSecondary: '#3B4A12', heroControl: '#A9D01B', heroThumb: '#FFFFFF', heroThumbInk: '#131411',
  /** 25A-03: the hero amount's two quiet parts on the field (`Money onField`): the currency symbol, then the cents a step
   * lighter, both neutral graphite. Solid, never the ink at an alpha: translucent ink over the lime reads olive. The
   * whole units stay `heroInk`. 8.4:1 and 6.0:1 on the light field, 7.2:1 and 5.1:1 on the dark one. */
  heroMoneySymbol: '#3A3C3F', heroMoneyCents: '#505255',
  heroStatusBar: 'dark' as 'light' | 'dark',
  /** Electric Lime as an accent: the dock's «+» and the Assistant's circle (ink glyph on it, 14.1:1). */
  accent: '#C6F12E', onAccent: '#131411',
  /** The dock: a graphite pill in both themes (its glass tint, and the solid fill under Reduce Transparency), the inactive
   * glyphs (7.0:1), and the selected tab's capsule with its white glyph. The capsule and the filled glyph mark the
   * selection, never the colour alone; only the «+» beside it is lime. */
  dock: '#1D1F1B', dockInk: '#A9ADA3', dockActive: '#3A3D37', dockActiveInk: '#FFFFFF',
};

export const darkPalette: typeof lightPalette = {
  /** A neutral near-black, not crushed #000, with surfaces in visible steps above it. */
  background: '#0B0C0A', surface: '#1A1C19', inset: '#232622', elevated: '#2F322C',
  text: '#F1F3EC', secondary: '#AAADA5', tertiary: '#9A9D95', line: '#2A2D28',
  /** Brand text on the near-black: a softened lime (14.1:1), so links and checks do not glow. */
  primary: '#C9E76B',
  /** The Electric Lime fill with ink on it (14.1:1). */
  primaryFill: '#C6F12E', onPrimary: '#131411',
  primarySoft: '#20260F',
  /** Dark: a clear step above the surface track, so the state reads without colour. */
  thumb: '#3A3E37',
  link: '#C9E76B',
  /** A deeper olive-lime than light's text tone could be, so the white knob holds 4.9:1 and the track 3.1:1 on the inset. */
  toggle: '#5C7A06',
  expense: '#EE8A72', income: '#5CCB93', transfer: '#A3B5C4', warning: '#E8A94A',
  expenseSoft: '#34201A', incomeSoft: '#13291D', transferSoft: '#1C252D', warningSoft: '#2F2413',
  /** Dark: deeper than the text tones so white holds 4.5:1 or more. */
  swipeDestructive: '#B8412D', swipeNeutral: '#50544D', swipeAccent: '#4E6600',
  shadow: 'rgba(0, 0, 0, 0)',
  scrim: 'rgba(0, 0, 0, 0.60)',
  /** A step below the light field's lime so a large field does not glare on a dark screen; ink on it as in light. */
  hero: '#B8E02A', heroInk: '#131411', heroSecondary: '#3A4318', heroControl: '#9FC51C', heroThumb: '#FFFFFF', heroThumbInk: '#131411',
  /** The field stays light in dark mode, so its quiet amount tones are the same graphite. */
  heroMoneySymbol: '#3A3C3F', heroMoneyCents: '#505255',
  heroStatusBar: 'dark',
  accent: '#C6F12E', onAccent: '#131411',
  dock: '#20221E', dockInk: '#A9ADA3', dockActive: '#3D403A', dockActiveInk: '#FFFFFF',
};

export type PaletteColors = typeof lightPalette;
