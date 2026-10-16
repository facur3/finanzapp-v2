import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { currencyFlag, regionFlag } from '../i18n/flags';
import type { IconName } from './appearance';
import { radius, usePalette } from './theme';

/** 25O1: the mark of a region or a currency (`flags.ts`): its emoji flag on the inset tile a row's leading glyph sits
 * on, or a neutral glyph when it has none. It decorates a name that already says it, so VoiceOver never reads it. The
 * tile keeps its side at every text size, like `GlyphTile`; the flag is the system's emoji, drawn as iOS draws it. */
export function FlagTile({ flag, fallback, size = 40 }: { flag: string | null; fallback: IconName; size?: number }) {
  const p = usePalette();
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: size, height: size, borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center', backgroundColor: p.inset }}>
    {flag ? <Text allowFontScaling={false} style={{ fontSize: Math.round(size * 0.55), lineHeight: Math.round(size * 0.7) }}>{flag}</Text>
      : <Ionicons name={fallback} size={Math.round(size * 0.5)} color={p.secondary} />}
  </View>;
}

/** A region's flag on its tile (Región's rows, Más, the onboarding). */
export function RegionMark({ region, size }: { region: string; size?: number }) {
  return <FlagTile flag={regionFlag(region)} fallback="globe-outline" size={size} />;
}

/** A currency's mark: its issuer's flag, always beside the code it marks; the neutral cash glyph for a supranational code. */
export function CurrencyMark({ currency, size }: { currency: string; size?: number }) {
  return <FlagTile flag={currencyFlag(currency)} fallback="cash-outline" size={size} />;
}

/** A flag inline with text (a chip, a pill, a section header): the text's own size, hidden from VoiceOver, nothing when
 * the code has no flag. */
export function InlineFlag({ flag, size = 17 }: { flag: string | null; size?: number }) {
  if (!flag) return null;
  return <Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" maxFontSizeMultiplier={1.6}
    style={{ fontSize: size }}>{flag}</Text>;
}
