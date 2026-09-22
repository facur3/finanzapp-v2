import { useMemo, type ComponentType, type ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Constants from 'expo-constants';
import { drawReason, glassDisabledBy, loadReason, materialFor, type Material, type MaterialReason } from './material-policy';
import { useReduceTransparency } from './theme';

/** The one boundary between FinanzApp and `expo-glass-effect`.
 *
 * The module is never imported statically: its JavaScript binds the native
 * view manager at evaluation time, and mounting that view in a binary whose
 * module registry cannot create it ends in a native `fatalError` after the
 * bundle has loaded. So this adapter first decides whether the module may be
 * loaded at all (`loadReason`: not in Expo Go, not when switched off, not off
 * iOS, not when the running binary has no registered `GlassView`), and only
 * then requires it, once, inside a try/catch, and asks it whether glass can
 * be drawn. Expo Go always gets the opaque material; native Liquid Glass is
 * for the development build (expo-dev-client), where the embedded module is
 * the one in the lockfile. */
type GlassModule = typeof import('expo-glass-effect');
type GlassRuntime = { GlassView: ComponentType<any>; liquidGlass: boolean; apiAvailable: boolean };

type ExpoRegistry = { modules?: Record<string, unknown>; getViewConfig?: (moduleName: string, viewName?: string) => unknown };

/** Expo Go, the store client: `expoGoConfig` comes from its manifest and `appOwnership` is its legacy marker. A development build has neither. */
export function runningInExpoGo(constants: { expoGoConfig?: unknown; appOwnership?: string | null } | undefined = Constants): boolean {
  try {
    // No constants at all: nothing says this is a development build, so it is treated as the store client.
    if (!constants) return true;
    return constants.expoGoConfig != null || constants.appOwnership === 'expo';
  } catch { return true; }
}

/** Whether the running binary registered the glass module and its view. Read from the registry, which answers null instead of throwing. */
export function glassViewRegistered(registry: ExpoRegistry | undefined = (globalThis as { expo?: ExpoRegistry }).expo): boolean {
  try {
    if (!registry?.modules || !('ExpoGlassEffect' in registry.modules)) return false;
    return typeof registry.getViewConfig === 'function' ? registry.getViewConfig('ExpoGlassEffect', 'GlassView') != null : false;
  } catch { return false; }
}

let runtime: GlassRuntime | null | undefined;

/** Loads the module at most once per session, and only when `loadReason` allows it. Any failure means "no glass", never an error. */
export function glassRuntime(load: () => GlassModule = () => require('expo-glass-effect') as GlassModule,
  conditions = { platform: Platform.OS, expoGo: runningInExpoGo(), disabled: glassDisabledBy(process.env), nativeRegistered: glassViewRegistered() }): GlassRuntime | null {
  if (runtime !== undefined) return runtime;
  if (loadReason(conditions)) { runtime = null; return runtime; }
  try {
    const glass = load();
    runtime = { GlassView: glass.GlassView, liquidGlass: !!glass.isLiquidGlassAvailable(), apiAvailable: !!glass.isGlassEffectAPIAvailable() };
  } catch { runtime = null; }
  return runtime;
}

/** Test seam: forget the loaded module so the next call decides again. */
export function resetGlassRuntime() { runtime = undefined; }

/** Which material this session gets and why. Availability is decided once; the accessibility setting is live. */
export function useMaterialDecision(): { material: Material; reason: MaterialReason } {
  const reduceTransparency = useReduceTransparency();
  const load = useMemo(() => ({ platform: Platform.OS, expoGo: runningInExpoGo(), disabled: glassDisabledBy(process.env), nativeRegistered: glassViewRegistered() }), []);
  const glass = useMemo(() => glassRuntime(undefined, load), [load]);
  return materialFor(load, glass ? { liquidGlass: glass.liquidGlass, apiAvailable: glass.apiAvailable, reduceTransparency } : null);
}

export function useMaterial(): Material {
  return useMaterialDecision().material;
}

/** One control surface, drawn as glass or as its opaque material. `style`
 * carries the geometry both share (size, radius, padding); `opaque` the
 * fill, edge and shadow of the opaque version; `tint` a wash for the glass.
 * Callers never animate this view's opacity: at 0 the effect stops drawing,
 * so press feedback stays a scale. Glass is only rendered through the loaded
 * runtime; without it the material is opaque whatever the caller asked. */
export function ControlSurface({ material, style, opaque, tint, children, interactive = false }: {
  material: Material; style?: StyleProp<ViewStyle>; opaque: ViewStyle; tint?: string; children?: ReactNode; interactive?: boolean;
}) {
  const glass = material === 'glass' ? glassRuntime() : null;
  if (glass && drawReason({ liquidGlass: glass.liquidGlass, apiAvailable: glass.apiAvailable, reduceTransparency: false }) === 'glass') {
    const GlassView = glass.GlassView;
    return <GlassView glassEffectStyle="regular" tintColor={tint} isInteractive={interactive} style={style}>{children}</GlassView>;
  }
  return <View style={[style, opaque]}>{children}</View>;
}
