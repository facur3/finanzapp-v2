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
