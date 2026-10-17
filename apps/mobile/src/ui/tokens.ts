import type { TextStyle } from 'react-native';

/** The type scale, the corner radii and the spacing steps, free of React Native at run time so Node can pin them
 * (tests/theme.node.ts). Screens import them through `theme.ts`. */

/** System font (SF Pro on iOS). Numbers are always tabular so amounts align. */
export const type = {
  hero: { fontSize: 44, lineHeight: 52, fontWeight: '700', letterSpacing: -1.3, fontVariant: ['tabular-nums'] } as TextStyle,
  /** 25O1: the first opening's story headlines, a step above the Large Title. */
  display: { fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -1.1 } as TextStyle,
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.8 } as TextStyle,
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.6 } as TextStyle,
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 } as TextStyle,
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: -0.3 } as TextStyle,
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 } as TextStyle,
  body: { fontSize: 17, lineHeight: 22 } as TextStyle,
  subhead: { fontSize: 15, lineHeight: 20 } as TextStyle,
  footnote: { fontSize: 13, lineHeight: 18 } as TextStyle,
  caption: { fontSize: 12, lineHeight: 16 } as TextStyle,
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.7, textTransform: 'uppercase' } as TextStyle,
};

export const radius = { chip: 14, tile: 12, group: 16, card: 20, sheet: 24, creditCard: 18, button: 14 };
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 };
