/** The FinanzApp colour system, free of React Native so its contrast can be
 * checked in Node.
 *
 * FinanzApp Forest (Producto 24UX6A, decision 005): a mineral grey-green
 * ground (true OLED black in dark), ink for text and money, and one pine brand
 * in the 158–168° hue window, never teal, cyan, emerald or blue. The brand
 * (`primary`, `primaryFill`) marks interaction and selection; the pine `hero`
 * field carries Inicio's financial header; the soft sage-mint `accent` is kept
 * for the dock's «+» and the Assistant's circle in the capture hub (the selected tab
 * is the `dockActive` capsule).
 * Glass is a control layer only, allowed on the dock, the «+», the capture hub,
 * compact circular controls, menus and the composer; this PR draws it on the
 * dock pill, the account detail's pills and the composer, and keeps the «+»
 * and the hub card solid. Rows, cards, balances, charts and sticky content
 * stay solid.
 *
 * Meaning never rides on colour alone and red never means "spent": an
 * expense amount is ink with a minus, income is `income` (positive) with a
 * plus, a transfer is the neutral secondary ink, and `expense` (negative) is
 * kept for what is destructive, overdue or over a limit. `warning` is due
 * soon. The category hues (category-color.ts, @finanzapp/domain appearance)
 * are a separate family and are not changed by this palette: a stored colour
 * id and a historical category's derived hue keep their identity. */
export const lightPalette = {
  /** Canvas, surface (groups, sheets, fields), inset (chips and fields on a surface), elevated (selected segment, popovers). */
  background: '#F0F3F1', surface: '#FFFFFF', inset: '#E6EBE8', elevated: '#FFFFFF',
  /** Ink: primary text and money (17.8:1 on white), secondary text and labels (7.8:1), tertiary for decimals, placeholders
   * and glyphs (5.8:1 on white, 4.8:1 on the inset). */
  text: '#0F1A16', secondary: '#45564E', tertiary: '#586961', line: '#DCE3DF',
  /** Brand text: links, the selected choice, active glyphs (8.5:1 on white). */
  primary: '#1D5647',
  /** Brand fill: the filled call to action, with white on it (9.3:1). */
  primaryFill: '#1D4F42', onPrimary: '#FFFFFF',
  /** A whisper of the brand for a tinted row or tile. */
  primarySoft: '#E1ECE7',
  /** The chosen segment of a compact segmented control on the canvas: white on the inset track. */
  thumb: '#FFFFFF',
  /** A quiet section link («Ver todos»): the brand text. */
  link: '#1D5647',
  /** Semantics. `expense` is the negative tone (destructive, overdue, over a limit), not ordinary spending. */
  expense: '#B3432E', income: '#1F7A4F', transfer: '#45564E', warning: '#9A5B00',
  expenseSoft: '#F7E6E1', incomeSoft: '#E2F1E8', transferSoft: '#E6EBE8', warningSoft: '#F7ECDB',
  /** Trailing swipe actions (24UX4): solid fills under a white label, each 4.5:1 or more. Destructive is the negative
   * tone, the reversible action a quiet grey, the forward action (pay, resume) the brand. */
  swipeDestructive: '#B3432E', swipeNeutral: '#5E6B65', swipeAccent: '#1D4F42',
  shadow: 'rgba(15, 26, 22, 0.08)',
  /** The dimming behind a sheet or the capture hub: the screen stays legible underneath. */
  scrim: 'rgba(0, 0, 0, 0.40)',
  /** Inicio's financial field (the pine hero) and what sits on it: ink (11.9:1), secondary ink (7.1:1), the fill of its
   * compact controls (the scope chip, the accounts button, the segmented track; ink 9.0:1 on it), and the chosen segment
   * (a near-white thumb with pine text, 12.3:1). Status-bar content over the field is light in both themes. */
  hero: '#14362D', heroInk: '#EEF5F1', heroSecondary: '#A8C4B9', heroControl: '#26493F', heroThumb: '#F4F8F6', heroThumbInk: '#14362D',
  /** The soft sage-mint accent: the dock's «+» and the Assistant's circle in the hub (pine glyph on it, 9.5:1). */
  accent: '#9FD8C1', onAccent: '#0F2A22',
  /** The dock: a pine pill in both themes (its glass tint, and the solid fill under Reduce Transparency), the inactive
   * glyphs (6.9:1), and the selected tab's capsule with its white glyph (6.8:1). The capsule and the filled glyph mark the
   * selection, never the colour alone. */
  dock: '#1B3C33', dockInk: '#B5C9C1', dockActive: '#3C6356', dockActiveInk: '#FFFFFF',
};

export const darkPalette: typeof lightPalette = {
  background: '#000000', surface: '#0F1513', inset: '#171E1B', elevated: '#252D2A',
  text: '#EDF3EF', secondary: '#A2B1A9', tertiary: '#899A91', line: '#1F2825',
  /** Brand text on black: 12.2:1, 8.2:1 on the elevated thumb. */
  primary: '#94D2BB',
  /** The mint brand fill with deep pine text on it (8.9:1). */
  primaryFill: '#86C9B0', onPrimary: '#05211A',
  primarySoft: '#14261F',
  /** Dark: a clear step above the surface track, so the state reads without colour. */
  thumb: '#323D39',
  link: '#94D2BB',
  expense: '#EE8A72', income: '#5CCB93', transfer: '#A2B1A9', warning: '#E8A94A',
  expenseSoft: '#34201A', incomeSoft: '#13291D', transferSoft: '#171E1B', warningSoft: '#2F2413',
  /** Dark: deeper than the text tones so white holds 4.5:1 or more. */
  swipeDestructive: '#B8412D', swipeNeutral: '#4E5A55', swipeAccent: '#2A6553',
  shadow: 'rgba(0, 0, 0, 0)',
  scrim: 'rgba(0, 0, 0, 0.60)',
  hero: '#0F2A22', heroInk: '#EDF5F0', heroSecondary: '#A1BDB2', heroControl: '#1E3D34', heroThumb: '#E4EEE9', heroThumbInk: '#0F2A22',
  accent: '#86C9B0', onAccent: '#05211A',
  dock: '#133029', dockInk: '#A9BFB6', dockActive: '#335A4E', dockActiveInk: '#FFFFFF',
};

export type PaletteColors = typeof lightPalette;
