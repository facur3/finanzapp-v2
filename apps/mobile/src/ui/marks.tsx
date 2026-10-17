import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { FLAG_ART } from '../i18n/flag-art';
import { currencyFlag, languageFlag, regionFlag } from '../i18n/flags';
import type { LanguageCode } from '../i18n/locale';
import type { IconName } from './appearance';
import { usePalette } from './theme';

/** 25O1: the round marks of a region, a currency and a language (`flags.ts` says which flag means what). A flag is vector
 * art clipped to a circle, ringed by a hairline of the palette's line so a white field (Japan's, Canada's) keeps its edge
 * on sand and on the dark surfaces; a code with no flag gets a neutral glyph on the same circle, so a list of marks keeps
 * one shape. A mark decorates a name that already says it: VoiceOver never reads it. */
const hidden = { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

function RoundFlag({ region, size }: { region: string; size: number }) {
  const p = usePalette();
  return <View {...hidden} style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
    <Svg width={size} height={size} viewBox="0 0 512 512">
      {FLAG_ART[region]!.map(([fill, d], index) => <Path key={index} fill={fill} d={d} />)}
    </Svg>
    <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth: StyleSheet.hairlineWidth, borderColor: p.line }]} />
  </View>;
}

/** A row's leading mark: the flag of `flag` (a region code, `flags.ts`), or the neutral glyph on the inset circle. It keeps
 * its side at every text size, like `GlyphTile`. */
export function FlagMark({ flag, fallback, size = 36 }: { flag: string | null; fallback: IconName; size?: number }) {
  const p = usePalette();
  if (flag) return <RoundFlag region={flag} size={size} />;
  return <View {...hidden} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: p.inset }}>
    <Ionicons name={fallback} size={Math.round(size * 0.5)} color={p.secondary} />
  </View>;
}

/** A region's flag (Región's rows, Más, the onboarding). */
export function RegionMark({ region, size }: { region: string; size?: number }) {
  return <FlagMark flag={regionFlag(region)} fallback="globe-outline" size={size} />;
}

/** A currency's mark: its issuer's flag, always beside the code it marks; the neutral cash glyph for a supranational code. */
export function CurrencyMark({ currency, size }: { currency: string; size?: number }) {
  return <FlagMark flag={currencyFlag(currency)} fallback="cash-outline" size={size} />;
}

/** A language's mark: the flag of the variety its catalogue is written in, beside words that say so. */
export function LanguageMark({ language, size }: { language: LanguageCode; size?: number }) {
  return <FlagMark flag={languageFlag(language)} fallback="language-outline" size={size} />;
}

/** A flag inline with text (a chip, a pill, a section header): a circle a little taller than the text's capitals, growing
 * with Dynamic Type as far as the text beside it does (1.6×), nothing when the code has no flag. Its row centres it. */
export function InlineFlag({ flag, size = 17 }: { flag: string | null; size?: number }) {
  const { fontScale } = useWindowDimensions();
  if (!flag) return null;
  return <RoundFlag region={flag} size={Math.round(size * 1.1 * Math.min(Math.max(fontScale, 1), 1.6))} />;
}
