/** WCAG 2 contrast between two six-digit hex colours. A helper module, not a test file: a test that imports a `*.node.ts`
 * file registers that file's tests again in its own run (25D1 found the theme's 25 counted twice, then three times). */
export function luminance(hex: string): number {
  const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(parseInt(hex.slice(1, 3), 16)) + 0.7152 * channel(parseInt(hex.slice(3, 5), 16)) + 0.0722 * channel(parseInt(hex.slice(5, 7), 16));
}
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** CIE L*a*b* (D65), to tell a grey-blue from a saturated blue where the hue alone cannot: chroma and colour distance. */
export function lab(hex: string): [number, number, number] {
  const lin = [1, 3, 5].map(index => { const c = parseInt(hex.slice(index, index + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const xyz = [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]].map(row => row.reduce((sum, k, i) => sum + k * lin[i], 0));
  const [x, y, z] = [xyz[0] / 0.95047, xyz[1], xyz[2] / 1.08883].map(t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
/** CIE76 colour distance: about 2.3 is the smallest step a person notices. */
export const deltaE = (one: string, two: string) => { const [p, q] = [lab(one), lab(two)]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
