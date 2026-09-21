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
