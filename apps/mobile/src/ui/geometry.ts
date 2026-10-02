/** Pure layout math shared by animated controls, kept free of React Native so
 * the numbers can be checked in Node. */

export const SEGMENT_PADDING = 2;
export const SEGMENT_GAP = 2;
/** 24T3 carry-in: Reportes' analysis switch («Categorías | Día a día»), the screen's main control, reads at the subhead
 * size (15/20, Inicio's switch size), never shrinks to fit (on iOS's new architecture the shrink's floor is 4 pt, not
 * `minimumFontScale`) and follows Dynamic Type up to 1.3×; its segments are 40 pt, so the track is 44 pt. */
export const PROMINENT_SEGMENT = { fontSize: 15, lineHeight: 20, maxScale: 1.3, minHeight: 40 } as const;

/** Geometry of a segmented control's sliding thumb: equal segments inside the padded track. */
export function segmentLayout(trackWidth: number, count: number, index: number): { width: number; offset: number } {
  if (!(trackWidth > 0) || !(count > 0)) return { width: 0, offset: 0 };
  const width = (trackWidth - SEGMENT_PADDING * 2 - SEGMENT_GAP * (count - 1)) / count;
  const clamped = Math.min(count - 1, Math.max(0, Math.floor(index)));
  return { width, offset: SEGMENT_PADDING + clamped * (width + SEGMENT_GAP) };
}

/** Producto 24T2, Tarjetas: a vertical deck of card faces, like a wallet. The cards not selected stay stacked above the
 * selected one in their stored order, each showing only its top strip (the row with the card's name and its last four
 * digits); the selected card sits in front at the bottom of the deck, whole, right above its snapshot. The face text is
 * capped at this Dynamic Type scale, so the strip that has to show its first row is capped too. */
export const DECK_MAX_TEXT_SCALE = 1.3;

/** Producto 24UX6D: the most cards whose strips keep the full 50 pt. A deck of up to four cards (three strips over the
 * front face, 373 pt on a 393 pt iPhone, 361 pt at 375 pt) leaves the start of the snapshot in the first screen; from the
 * fifth card on, every strip tightens to its compact height, so six cards take 30 pt less and twelve 66 pt less, and the
 * rule stays the same for any number of cards (no second geometry, no hidden cards, no horizontal carousel). */
export const DECK_FULL_STRIP_CARDS = 4;

/** The height of a strip: the face's top padding (16), its first row (22 pt of text at the capped scale) and a margin
 * under it, 12 pt with up to `DECK_FULL_STRIP_CARDS` cards (50 pt at the default size, 57 at the cap) and 6 pt beyond
 * (24UX6D: 44 pt, 51 at the cap). The first row always shows whole, and a strip is never under 44 pt, the touch target
 * iOS asks for, at every text size and for any number of cards. `count` is the number of cards in the deck (one by
 * default: the full strip). */
export function deckExposure(fontScale: number, count = 1): number {
  const scale = Math.min(Math.max(Number.isFinite(fontScale) ? fontScale : 1, 1), DECK_MAX_TEXT_SCALE);
  const margin = count > DECK_FULL_STRIP_CARDS ? 22 : 28;
  return Math.max(44, Math.round(margin + 22 * scale));
}

/** Where each card of the deck sits (`tops`, in the stored order of `count` cards) and how the cards layer (`zIndex`):
 * the others keep their relative order above, one strip each; the selected card is last, at `(count − 1) · exposure`,
 * above every strip. The container always measures `(count − 1) · exposure + faceHeight`, whichever card is selected, so
 * choosing a card never changes the height of the page. An index outside the deck falls back to the first card. 25UX1: the
 * deck's idle state (no card selected yet) is drawn as `count − 1`: the stored order, the last card whole at the bottom;
 * `CardDeck` decides which card, if any, is selected. */
export function deckLayout(count: number, selectedIndex: number, exposure: number, faceHeight: number): { tops: number[]; zIndex: number[]; containerHeight: number } {
  if (!(count > 0) || !Number.isInteger(count)) return { tops: [], zIndex: [], containerHeight: 0 };
  const selected = Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < count ? selectedIndex : 0;
  const zIndex = Array.from({ length: count }, (_, index) => index === selected ? count - 1 : index < selected ? index : index - 1);
  return { tops: zIndex.map(position => position * exposure), zIndex, containerHeight: (count - 1) * exposure + faceHeight };
}

/** Where Tarjetas scrolls after a card is chosen, or null when it need not (24T2 review). The chosen card always moves to
 * the front, at the bottom of the deck, so with many cards it lands below the visible area; the page then scrolls until
 * its top sits a quarter of the way down the viewport, with the start of its snapshot under it. Window coordinates are
 * measured before the move (the deck never moves or changes height); `contentOffset` is the current scroll offset. */
export function deckScrollTarget(input: { count: number; exposure: number; faceHeight: number; deckTop: number; viewportTop: number; viewportHeight: number;
  contentOffset: number }): number | null {
  const frontTop = input.deckTop + Math.max(0, input.count - 1) * input.exposure;
  // In view: its top below the top of the viewport and most of the face (name, last four, its middle) above the fold.
  if (frontTop >= input.viewportTop && frontTop + input.faceHeight * 0.4 <= input.viewportTop + input.viewportHeight) return null;
  return Math.max(0, input.contentOffset + frontTop - (input.viewportTop + input.viewportHeight * 0.25));
}

/** Advance widths, in em, of the glyphs an amount can contain, measured
 * generously for SF Pro bold tabular figures. Tabular digits share one width,
 * which is what makes the estimate reliable without measuring text natively. */
// The non-breaking space joins a symbol to its number; "AR$" is the peso's sign in the United States. The narrow
// no-break space and the apostrophe group digits in some catalogue regions (France, Switzerland; 24R2A).
const ADVANCE: Record<string, number> = { '.': 0.3, ',': 0.3, ' ': 0.28, '\u00A0': 0.28, '\u202F': 0.2, "'": 0.3, '$': 0.62, U: 0.74, S: 0.66, A: 0.74, R: 0.7, '−': 0.62, '+': 0.62, '-': 0.5 };
const DIGIT = 0.6;
export const SAFETY = 1.04;

/** Width of an amount string in em at font size 1. */
export function amountWidthEm(text: string): number {
  let em = 0;
  for (const char of text) em += /[0-9]/.test(char) ? DIGIT : ADVANCE[char] ?? 0.65;
  return em * SAFETY;
}

/** The amount field: base and minimum size and the caret's own width. */
export const AMOUNT_FIELD = { base: 46, min: 24, caret: 4 } as const;

/** Size of the currency symbol beside the field for a given amount size. */
export function amountSymbolSize(fontSize: number): number {
  return fontSize >= 40 ? 32 : fontSize >= 30 ? 26 : 22;
}

/** Geometry of the amount field, from the width of its row. The symbol is
 * anchored at the row's left edge and the input takes the rest of the row,
 * left-aligned, so the origin of the digits never depends on the text: a
 * keystroke only adds glyphs at the right. The only variable is the size,
 * and it steps down from `base` only when the amount would not fit between
 * the symbol, the gap and the caret's own room, never by character count;
 * the symbol's size follows the amount's. Before layout the base size
 * renders. Nothing here is a position: there is nothing to place. */
export function amountFieldLayout(text: string, rowWidth: number, symbol: string, gap: number, fontScale = 1): { fontSize: number; symbolSize: number } {
  const display = text || '0';
  const scale = Math.max(fontScale, 0.5);
  const symbolWidth = (size: number) => Math.ceil(amountWidthEm(symbol) * amountSymbolSize(size) * scale);
  if (!(rowWidth > 0)) return { fontSize: AMOUNT_FIELD.base, symbolSize: amountSymbolSize(AMOUNT_FIELD.base) };
  // Shrinking the amount also shrinks the symbol, which can only free room, so the loop converges downward.
  let fontSize: number = AMOUNT_FIELD.base;
  for (;;) {
    const next = fitFontSize(display, rowWidth - symbolWidth(fontSize) - gap - AMOUNT_FIELD.caret, AMOUNT_FIELD.base, AMOUNT_FIELD.min, scale);
    if (next >= fontSize) break;
    fontSize = next;
  }
  return { fontSize, symbolSize: amountSymbolSize(fontSize) };
}

/** The room the input has for its text at a given row width and symbol size. */
export function amountTextRoom(rowWidth: number, symbol: string, symbolSize: number, gap: number, fontScale = 1): number {
  return rowWidth - Math.ceil(amountWidthEm(symbol) * symbolSize * Math.max(fontScale, 0.5)) - gap - AMOUNT_FIELD.caret;
}

/** Rows that put a name beside an amount stack (amount under the name) at this system text scale. */
export const ROW_STACK_SCALE = 1.2;
/** Points a list row spends around its text on a phone: screen padding (20 + 20), row padding (16 + 16), the identity tile (40) and its gap (12). */
export const ROW_CHROME = 124;
/** 24UX6E: what a row's trailing chevron adds to `ROW_CHROME`: the 16 pt `chevron-forward` glyph and the row's 12 pt gap
 * before it. A row that draws that chevron (today AccountRow) passes `width - ROW_CHEVRON` to `rowStacks`, so an amount
 * that only fits once the chevron is ignored stacks under the name instead of being shrunk beside it. Rows without a
 * chevron (DebtRow, RecurringRow) pass the plain width; Reportes' legend keeps its own `LEGEND_CHEVRON` (a 15 pt glyph). */
export const ROW_CHEVRON = 28;
/** The widest share of the remaining row an amount may take beside a name. */
export const AMOUNT_SHARE = 0.56;
/** Row amounts render at the body size. */
export const ROW_AMOUNT_SIZE = 17;

/** Whether a row must put its amount under the name instead of beside it:
 * always at large text, and otherwise when the amount, at its full row size,
 * would not fit in its share of the row on this screen width (a 13-digit
 * price on any iPhone, a nine-digit one on a 375 pt iPhone). Stacking is
 * preferred to shrinking: an amount is never truncated and never squeezed
 * to read smaller than its neighbours because the row happened to be narrow.
 * Before layout (no width) only the text scale decides. */
export function rowStacks(windowWidth: number, fontScale: number, amountText?: string): boolean {
  if (fontScale > ROW_STACK_SCALE) return true;
  if (!amountText || !(windowWidth > 0)) return false;
  const room = Math.max(0, windowWidth - ROW_CHROME) * AMOUNT_SHARE;
  return amountWidthEm(amountText) * ROW_AMOUNT_SIZE * Math.max(fontScale, 0.5) > room;
}

/** An upper estimate of a label's width in ems of the system font (SF Pro Text, regular to medium): narrow lowercase,
 * wider capitals and digits, thin spaces and punctuation. A line-fit estimate for deciding a layout, not a measurement:
 * it errs wide, so a row that "fits" never wraps its last letters. */
export function labelWidthEm(text: string): number {
  let em = 0;
  // Grapheme-aware without Intl.Segmenter (not every Hermes has it): a pictograph joined to the previous one by U+200D
  // belongs to the same glyph (a family, a rainbow flag), and two regional indicators are one flag.
  let joined = false, openFlag = false;
  for (const char of text) {
    if (char === '\u200D') { joined = true; continue; }
    const wasJoined = joined;
    joined = false;
    // Variation selectors, skin-tone modifiers and combining marks add no width of their own.
    if (/[\uFE0E\uFE0F]|\p{Emoji_Modifier}|\p{Mark}/u.test(char)) continue;
    if (/\p{Regional_Indicator}/u.test(char)) {
      if (openFlag) { openFlag = false; continue; }
      openFlag = true;
      em += 1.25;
      continue;
    }
    openFlag = false;
    if (/\p{Extended_Pictographic}/u.test(char)) { if (!wasJoined) em += 1.25; continue; }
    em += char === ' ' ? 0.28
      // Full-width scripts and forms: an ideograph, kana (with the katakana middle dot) or hangul is about one em.
      : /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303F\u30A0-\u30FF\uFF00-\uFFEF]/u.test(char) ? 1
      : /[.,:;·'’!|il]/.test(char) ? 0.3 : /[A-ZÁÉÍÓÚÑÜ0-9mwMW]/.test(char) ? 0.68 : 0.54;
  }
  return em * SAFETY;
}

/** A name beside an amount on one line (24UX6C2): whether the name, at the body size, and the amount, at the row amount
 * size, fit together in the text column of a row whose fixed parts take `chrome` points (screen padding, row padding, the
 * identity tile and its gap, a chevron). When they do not, the row stacks (the amount and its share under the name)
 * instead of wrapping the name into a stray last letter or shrinking the money. Large text always stacks. */
export function labelAmountStacks(windowWidth: number, fontScale: number, label: string, amountText: string, chrome = ROW_CHROME): boolean {
  if (fontScale > ROW_STACK_SCALE) return true;
  if (!(windowWidth > 0)) return false;
  const scale = Math.max(fontScale, 0.5);
  const room = Math.max(0, windowWidth - chrome);
  const gap = 8;
  return labelWidthEm(label) * ROW_AMOUNT_SIZE * scale + gap + amountWidthEm(amountText) * ROW_AMOUNT_SIZE * scale > room;
}

/** The largest font size, at most `base` and at least `min`, at which `text`
 * fits `width` on one line once the system text scale is applied. Scaling only
 * happens when needed, so a short amount stays at `base`; a long one shrinks
 * exactly as much as its width requires and never below `min`. */
export function fitFontSize(text: string, width: number, base: number, min: number, fontScale = 1): number {
  if (!(width > 0)) return base;
  const scale = Math.max(fontScale, 0.5);
  const fitting = width / (amountWidthEm(text) * scale);
  return Math.max(min, Math.min(base, Math.floor(fitting * 2) / 2));
}
