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

/** Geometry of the amount field, from the width of its row. The input spans
 * the whole row and centres its text natively inside fixed padding, so its
 * box never changes while typing: a new digit or grouping dot only lets the
 * text grow symmetrically around the box's centre, as any centred field does.
 * `paddingLeft` reserves the symbol and the gap, `paddingRight` the caret;
 * the number therefore sits a little right of the row's centre and the
 * symbol beside it, so the pair reads as centred. The symbol is drawn at
 * `symbolX` from the row's left, one gap before the text's left edge, from
 * the estimated text width: it slides half an advance per digit, like that
 * edge, and its position is arithmetic, never a layout pass. The size steps
 * down from `base` only when the text would not fit between the paddings,
 * never by character count. Before layout the field keeps the base size and
 * the symbol is not placed. */
export function amountFieldLayout(text: string, rowWidth: number, symbol: string, gap: number, fontScale = 1): {
  fontSize: number; symbolSize: number; paddingLeft: number; paddingRight: number; symbolX: number | null;
} {
  const display = text || '0';
  const scale = Math.max(fontScale, 0.5);
  const symbolWidth = (size: number) => Math.ceil(amountWidthEm(symbol) * amountSymbolSize(size) * scale);
  const paddingRight = AMOUNT_FIELD.caret;
  if (!(rowWidth > 0)) return { fontSize: AMOUNT_FIELD.base, symbolSize: amountSymbolSize(AMOUNT_FIELD.base), paddingLeft: symbolWidth(AMOUNT_FIELD.base) + gap, paddingRight, symbolX: null };
  // The symbol's size follows the amount's, so shrinking the amount can only free room.
  let fontSize: number = AMOUNT_FIELD.base;
  for (;;) {
    const next = fitFontSize(display, rowWidth - symbolWidth(fontSize) - gap - paddingRight, AMOUNT_FIELD.base, AMOUNT_FIELD.min, scale);
    if (next >= fontSize) break;
    fontSize = next;
  }
  const symbolSize = amountSymbolSize(fontSize);
  const paddingLeft = symbolWidth(fontSize) + gap;
  // Advance widths without the fit's safety margin: the symbol should hug the text, not the estimate.
  const textWidth = amountWidthEm(display) / SAFETY * fontSize * scale;
  const textLeft = paddingLeft + (rowWidth - paddingLeft - paddingRight - textWidth) / 2;
  const symbolX = Math.max(0, Math.round(textLeft - gap - symbolWidth(fontSize)));
  return { fontSize, symbolSize, paddingLeft, paddingRight, symbolX };
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
