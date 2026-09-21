import { useMemo, type ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { materialFor, type Material } from './material-policy';
import { useReduceTransparency } from './theme';

/** Which material a control gets in this session: native Liquid Glass on
 * iOS 26 with the API present and Reduce Transparency off, otherwise the
 * opaque material. The two availability checks are native and constant for
 * the process; the accessibility setting is live. */
export function useMaterial(): Material {
  const reduceTransparency = useReduceTransparency();
  const available = useMemo(() => {
    try { return { liquidGlass: isLiquidGlassAvailable(), apiAvailable: isGlassEffectAPIAvailable() }; }
    catch { return { liquidGlass: false, apiAvailable: false }; }
  }, []);
  return materialFor({ platform: Platform.OS, ...available, reduceTransparency });
}

/** One control surface, drawn as glass or as its opaque material. `style`
 * carries the geometry both share (size, radius, padding); `opaque` the
 * fill, edge and shadow of the opaque version; `tint` a wash for the glass.
 * Callers never animate this view's opacity: at 0 the effect stops drawing,
 * so press feedback stays a scale. */
export function ControlSurface({ material, style, opaque, tint, children, interactive = false }: {
  material: Material; style?: StyleProp<ViewStyle>; opaque: ViewStyle; tint?: string; children?: ReactNode; interactive?: boolean;
}) {
  if (material === 'glass') return <GlassView glassEffectStyle="regular" tintColor={tint} isInteractive={interactive} style={style}>{children}</GlassView>;
  return <View style={[style, opaque]}>{children}</View>;
}
