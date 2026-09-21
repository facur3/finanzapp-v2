/** Pure layout math shared by animated controls, kept free of React Native so
 * the numbers can be checked in Node. */

export const SEGMENT_PADDING = 2;
export const SEGMENT_GAP = 2;

/** Geometry of a segmented control's sliding thumb: equal segments inside the padded track. */
export function segmentLayout(trackWidth: number, count: number, index: number): { width: number; offset: number } {
  if (!(trackWidth > 0) || !(count > 0)) return { width: 0, offset: 0 };
  const width = (trackWidth - SEGMENT_PADDING * 2 - SEGMENT_GAP * (count - 1)) / count;
  const clamped = Math.min(count - 1, Math.max(0, Math.floor(index)));
  return { width, offset: SEGMENT_PADDING + clamped * (width + SEGMENT_GAP) };
}

/** Which carousel page a horizontal offset has settled on. */
export function carouselIndex(offsetX: number, step: number, count: number): number {
  if (!(step > 0) || !(count > 0)) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(offsetX / step)));
}

/** Advance widths, in em, of the glyphs an amount can contain, measured
 * generously for SF Pro bold tabular figures. Tabular digits share one width,
 * which is what makes the estimate reliable without measuring text natively. */
const ADVANCE: Record<string, number> = { '.': 0.3, ',': 0.3, ' ': 0.28, '$': 0.62, U: 0.74, S: 0.66, '−': 0.62, '+': 0.62 };
const DIGIT = 0.6;
const SAFETY = 1.04;

/** Width of an amount string in em at font size 1. */
export function amountWidthEm(text: string): number {
  let em = 0;
  for (const char of text) em += /[0-9]/.test(char) ? DIGIT : ADVANCE[char] ?? 0.65;
  return em * SAFETY;
}

/** The amount field's box: base and minimum size, the room kept on each side
 * of the text, the caret's own width and the narrowest box a lone digit gets. */
export const AMOUNT_FIELD = { base: 46, min: 24, padding: 8, caret: 4, minWidth: 72 } as const;

/** Size of the currency symbol beside the field for a given amount size. */
export function amountSymbolSize(fontSize: number): number {
  return fontSize >= 40 ? 32 : fontSize >= 30 ? 26 : 22;
}

/** Font size and explicit width for the amount field, from the width of its
 * row. The native text input is not left to size itself around its text: on
 * iOS a field exactly as wide as its content draws the caret over the last
 * glyph and, with negative tracking, clips that glyph's right edge. Instead
 * the box is the estimated text width (tabular glyphs, measured generously)
 * plus padding on both sides and the caret's width, so the last digit, the
 * caret and a grouping dot that has just appeared always have room. The size
 * shrinks only when the text would not fit the row at `base`, never by
 * character count. Before layout there is no width, and the field keeps the
 * base size. */
export function amountFieldLayout(text: string, rowWidth: number, symbol: string, gap: number, fontScale = 1): { fontSize: number; width: number | undefined; symbolSize: number } {
  const display = text || '0';
  const scale = Math.max(fontScale, 0.5);
  if (!(rowWidth > 0)) return { fontSize: AMOUNT_FIELD.base, width: undefined, symbolSize: amountSymbolSize(AMOUNT_FIELD.base) };
  const room = AMOUNT_FIELD.padding * 2 + AMOUNT_FIELD.caret;
  // The symbol's size follows the amount's, so shrinking the amount can only free
  // room: step down from the base until the text fits beside the symbol at that size.
  const symbolWidth = (size: number) => Math.ceil(amountWidthEm(symbol) * amountSymbolSize(size) * scale);
  let fontSize: number = AMOUNT_FIELD.base;
  for (;;) {
    const next = fitFontSize(display, rowWidth - symbolWidth(fontSize) - gap - room, AMOUNT_FIELD.base, AMOUNT_FIELD.min, scale);
    if (next >= fontSize) break;
    fontSize = next;
  }
  const symbolSize = amountSymbolSize(fontSize);
  const textWidth = Math.ceil(amountWidthEm(display) * fontSize * scale);
  const width = Math.min(rowWidth - symbolWidth(fontSize) - gap, Math.max(AMOUNT_FIELD.minWidth, textWidth + room));
  return { fontSize, width, symbolSize };
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
