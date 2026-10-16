/** The FinanzApp colour system, free of React Native so its contrast can be
 * checked in Node.
 *
 * Sapphire + Sand (Producto 25VIS2, a palette trial on decision 005's structure; brand-brief.md §4.9, sheet B): warm
 * sand grounds in light and a warm near-black (never crushed #000) in dark, near-black ink for text and money, and
 * one true sapphire brand (≈225°, never toward violet or navy). The sapphire is a field: Inicio's financial header
 * (`hero`, white on it), the filled call to action (`primaryFill`) and the dock's «+» and the Assistant's circle
 * (`accent`). As text (`primary`, `link`, the selected choice, checks) it is the same sapphire in light and a lighter
 * periwinkle in dark, so it reads on the near-black. Everything else, the dock included, stays a warm neutral.
 * Electric Lime (25VIS1) was replaced token for token under the same names: no second palette exists, and its values
 * live in git history (master 6611376) should the owner keep Lime after the iPhone comparison.
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
 * destructive, overdue or over a limit. `warning` is due soon. Sapphire never means success, income, warning or alert.
 * The slate transfer sits near the brand's hue and is kept apart by colourfulness instead (a grey-blue against a
 * saturated sapphire, pinned by theme.node.ts). The category hues (category-color.ts, @finanzapp/domain appearance)
 * and the card faces (card-faces.ts) are separate families and are not changed by this palette: a stored colour id and
 * a historical category's derived hue keep their identity. */
export const lightPalette = {
  /** Canvas (sand), surface (groups, sheets, fields), inset (chips and fields on a surface), elevated (selected segment, popovers). */
  background: '#F3EFE6', surface: '#FFFCF6', inset: '#E9E3D6', elevated: '#FFFFFF',
  /** Ink: primary text and money, secondary text and labels, tertiary for decimals, placeholders and glyphs (3:1 or
   * more on every ground). */
  text: '#19191C', secondary: '#514E47', tertiary: '#625E56', line: '#DDD6C8',
  /** Brand text: links, the selected choice, active glyphs. The sapphire itself (7.4:1 on the surface). */
  primary: '#2148C0',
  /** Brand fill: the filled call to action, sapphire with white on it (7.6:1). */
  primaryFill: '#2148C0', onPrimary: '#FFFFFF',
  /** A whisper of the brand for a tinted row or tile. */
  primarySoft: '#E4E9F7',
  /** The chosen segment of a compact segmented control on the canvas: white on the inset track. */
  thumb: '#FFFFFF',
  /** A quiet section link («Ver todos»): the brand text. */
  link: '#2148C0',
  /** A switch that is on: the sapphire, its white knob 7.6:1. */
  toggle: '#2148C0',
  /** Semantics. `expense` is the negative tone (destructive, overdue, over a limit), not ordinary spending. */
  /** `transfer`: a neutral slate (≈203°, low saturation), 6.6:1 on white; apart from the sapphire by colourfulness. */
  expense: '#B3432E', income: '#1F7A4F', transfer: '#48606F', warning: '#9A5B00',
  expenseSoft: '#F7E6E1', incomeSoft: '#E2F1E8', transferSoft: '#E4EAEE', warningSoft: '#F7ECDB',
  /** The label and glyph on a filled semantic button (`ActionButton` with a tone, not secondary): white on every light
   * fill, 5.3:1 or more. */
  onSemantic: '#FFFFFF',
  /** Trailing swipe actions (24UX4): solid fills under a white label, each 4.5:1 or more. Destructive is the negative
   * tone, the reversible action a quiet warm grey, the forward action (pay, resume) the sapphire. */
  swipeDestructive: '#B3432E', swipeNeutral: '#5E5A52', swipeAccent: '#2148C0',
  shadow: 'rgba(25, 25, 28, 0.08)',
  /** The dimming behind a sheet or the capture hub: the screen stays legible underneath. */
  scrim: 'rgba(0, 0, 0, 0.40)',
  /** Inicio's financial field (the sapphire hero) and what sits on it: white (7.6:1), a pale sapphire secondary, the
   * darker fill of its compact controls (the scope chip, the accounts button, the segmented track), and the chosen
   * segment (the light surface's sand-white thumb with the light ink, 17:1). The field is dark in both themes, so the
   * status bar over it is light. */
  hero: '#2148C0', heroInk: '#FFFFFF', heroSecondary: '#D3DCF6', heroControl: '#1A3A9E', heroThumb: '#FFFCF6', heroThumbInk: '#19191C',
  /** 25A-03: the hero amount's two quiet parts on the field (`Money onField`): the currency symbol, then the cents a step
   * quieter, both solid neutral greys under the white units (never white at an alpha, which tints with the field).
   * 5.9:1 and 4.6:1 on the light field, 6.3:1 and 5.0:1 on the dark one. */
  heroMoneySymbol: '#E2E2E5', heroMoneyCents: '#C9C9CD',
  heroStatusBar: 'light' as 'light' | 'dark',
  /** Sapphire as an accent: the dock's «+» and the Assistant's circle (white glyph on it, 7.6:1). */
  accent: '#2148C0', onAccent: '#FFFFFF',
  /** The dock: a warm graphite pill in both themes (its glass tint, and the solid fill under Reduce Transparency), the
   * inactive glyphs, and the selected tab's capsule with its white glyph. The capsule and the filled glyph mark the
   * selection, never the colour alone; only the «+» beside it is sapphire. */
  dock: '#1E1D1B', dockInk: '#A9A498', dockActive: '#403E38', dockActiveInk: '#FFFFFF',
};

export const darkPalette: typeof lightPalette = {
  /** A warm near-black, not crushed #000, with surfaces in visible steps above it. */
  background: '#0C0B0A', surface: '#1B1A18', inset: '#24231F', elevated: '#34322D',
  /** Tertiary #A09B90: Reportes' idle bars hold 3:1 against the canvas (#9C978C did not). */
  text: '#F3F0E8', secondary: '#ADA89C', tertiary: '#A09B90', line: '#2C2A26',
  /** Brand text on the near-black: a periwinkle sapphire (4.8:1 even on the elevated step), far enough from the slate
   * transfer in colourfulness (the lighter #9DB4FF was the slate's own lightness). */
  primary: '#7E9BF7',
  /** The sapphire fill with white on it (4.8:1). 25O1 (owner sheet D03, decided under the design delegation): the same
   * value as the switch, so the dark theme carries two brand fills instead of three (this one, and the periwinkle «+»). */
  primaryFill: '#4568DA', onPrimary: '#FFFFFF',
  primarySoft: '#19223F',
  /** Dark: a clear step above the surface track, so the state reads without colour. */
  thumb: '#3C3A35',
  link: '#7E9BF7',
  /** The white knob holds 4.9:1 and the track 3.2:1 on the inset. */
  toggle: '#4568DA',
  expense: '#EE8A72', income: '#5CCB93', transfer: '#A3B5C4', warning: '#E8A94A',
  expenseSoft: '#34201A', incomeSoft: '#13291D', transferSoft: '#1C252D', warningSoft: '#2F2413',
  /** Dark: the semantic tones are light, so white on them fell to 2.0–2.5:1 («Pagar tarjeta» was 2.1:1); ink holds 7:1 or more. */
  onSemantic: '#19191C',
  /** Dark: deeper than the text tones so white holds 4.5:1 or more (the accent is the filled button's sapphire, 25O1). */
  swipeDestructive: '#B8412D', swipeNeutral: '#524F48', swipeAccent: '#4568DA',
  shadow: 'rgba(0, 0, 0, 0)',
  scrim: 'rgba(0, 0, 0, 0.60)',
  /** A step below the light field's sapphire so a large field does not glare on a dark screen; white on it as in light. */
  hero: '#2446AE', heroInk: '#FFFFFF', heroSecondary: '#C9D4F5', heroControl: '#1A3790', heroThumb: '#FFFCF6', heroThumbInk: '#19191C',
  /** The field is the same kind of dark sapphire, so its quiet amount tones are the same greys. */
  heroMoneySymbol: '#E2E2E5', heroMoneyCents: '#C9C9CD',
  heroStatusBar: 'light',
  /** The «+» and the Assistant's circle: the periwinkle with ink on it (6.6:1), the brightest object on the near-black. */
  accent: '#7E9BF7', onAccent: '#19191C',
  dock: '#201F1C', dockInk: '#A9A498', dockActive: '#43413B', dockActiveInk: '#FFFFFF',
};

export type PaletteColors = typeof lightPalette;

/** 25D1: how much of a coloured hero's own tone its symbol and cents keep (two-digit hex alpha). The quiet parts sit over
 * any ground (the canvas, a card, a sheet); on the light sand 30 to 45 % of the ground showed through and the cents fell
 * to 2.2:1, under the 3:1 a hero's figure (28 pt or more) needs. Floors pinned by tests/contrast-floors.node.ts. */
export const QUIET_ALPHA = { light: { symbol: 'E6', cents: 'CC' }, dark: { symbol: 'B3', cents: '99' } } as const;

/** A coloured hero's symbol and cents: its own tone, quieter, one step each. `null` for an ink that is not a six-digit
 * hex (no valid colour can be built from it; the caller falls back to the neutral pair). */
export function quietTones(ink: string, isDark: boolean): { symbol: string; cents: string } | null {
  if (!/^#[0-9A-Fa-f]{6}$/.test(ink)) return null;
  const alpha = QUIET_ALPHA[isDark ? 'dark' : 'light'];
  return { symbol: ink + alpha.symbol, cents: ink + alpha.cents };
}
