/** Pure decisions behind the glass material and the composer's keyboard
 * geometry, free of React Native so they run in Node.
 *
 * Liquid Glass is a control layer, not a content layer: it is drawn only on
 * the four Home actions and the Assistant composer, and only when every
 * condition holds. Everything else, and every other case, gets the opaque
 * material from Producto 21, which is a designed state, not a fallback error.
 *
 * A decorative material must never be able to close the app. Mounting a
 * native view whose definition the running binary does not have ends in a
 * native `fatalError` inside Expo's Fabric initializer, after the JavaScript
 * has finished loading; a JavaScript try/catch cannot reach it. So the
 * decision is layered: first whether the glass module may be *loaded* at all
 * (never in Expo Go, never when switched off, never when the running binary
 * has not registered the view), and only then whether glass is *drawn*. */
export type Material = 'glass' | 'opaque';

/** Why the session got its material; shown in Más so a tester can confirm the mode. */
export type MaterialReason = 'disabled' | 'expo-go' | 'platform' | 'not-registered' | 'unavailable' | 'api' | 'reduce-transparency' | 'glass';

export type LoadConditions = {
  /** `Platform.OS`: only iOS has the material. */
  platform: string;
  /** Expo Go (the store client). Its embedded native modules are whatever it shipped with; stability wins over decoration. */
  expoGo: boolean;
  /** The kill switch: `EXPO_PUBLIC_DISABLE_GLASS=1`, a UI capability flag, never a secret. */
  disabled: boolean;
  /** The running binary registered the `ExpoGlassEffect` module and its `GlassView` view (checked through the registry, which never throws). */
  nativeRegistered: boolean;
};

export type DrawConditions = {
  /** `isLiquidGlassAvailable()`: iOS 26+, built with a Liquid Glass SDK, no compatibility flag. */
  liquidGlass: boolean;
  /** `isGlassEffectAPIAvailable()`: some iOS 26 betas lack the API and crash without this guard. */
  apiAvailable: boolean;
  /** The user's Reduce Transparency setting, or `true` until iOS has answered. */
  reduceTransparency: boolean;
};

/** Whether the glass module may be required at all. False means the module is never evaluated in this session. */
export function loadReason({ platform, expoGo, disabled, nativeRegistered }: LoadConditions): MaterialReason | null {
  if (disabled) return 'disabled';
  if (expoGo) return 'expo-go';
  if (platform !== 'ios') return 'platform';
  if (!nativeRegistered) return 'not-registered';
  return null;
}

export function drawReason({ liquidGlass, apiAvailable, reduceTransparency }: DrawConditions): MaterialReason {
  if (!liquidGlass) return 'unavailable';
  if (!apiAvailable) return 'api';
  if (reduceTransparency) return 'reduce-transparency';
  return 'glass';
}

export function materialFor(load: LoadConditions, draw: DrawConditions | null): { material: Material; reason: MaterialReason } {
  const blocked = loadReason(load);
  if (blocked) return { material: 'opaque', reason: blocked };
  const reason = draw ? drawReason(draw) : 'unavailable';
  return { material: reason === 'glass' ? 'glass' : 'opaque', reason };
}

/** `EXPO_PUBLIC_DISABLE_GLASS=1` forces the opaque material everywhere. */
export function glassDisabledBy(env: Record<string, string | undefined>): boolean {
  return env.EXPO_PUBLIC_DISABLE_GLASS === '1';
}

export const MATERIAL_LABELS: Record<MaterialReason, string> = {
  disabled: 'Material opaco (desactivado)',
  'expo-go': 'Material opaco (Expo Go)',
  platform: 'Material opaco',
  'not-registered': 'Material opaco (sin módulo nativo)',
  unavailable: 'Material opaco (iOS sin Liquid Glass)',
  api: 'Material opaco (API no disponible)',
  'reduce-transparency': 'Material opaco (Reducir transparencia)',
  glass: 'Liquid Glass',
};

/** The shape of React Native's AccessibilityInfo this code relies on; every member is optional because an older or mismatched runtime may lack it. */
export type ReduceTransparencyAPI = {
  isReduceTransparencyEnabled?: () => Promise<boolean>;
  addEventListener?: (event: 'reduceTransparencyChanged', handler: (value: boolean) => void) => { remove: () => void };
};

/** Read and follow the Reduce Transparency setting without ever throwing.
 * A missing or failing API leaves the value at `true` (opaque). Returns the
 * unsubscribe; `set` is never called after it. */
export function subscribeReduceTransparency(api: ReduceTransparencyAPI | undefined, set: (value: boolean) => void): () => void {
  let live = true;
  const apply = (value: unknown) => { if (live && typeof value === 'boolean') set(value); };
  try {
    if (typeof api?.isReduceTransparencyEnabled === 'function') {
      const answer = api.isReduceTransparencyEnabled();
      if (answer && typeof answer.then === 'function') void answer.then(apply, () => {});
    }
  } catch { /* An absent or broken native query keeps the opaque material. */ }
  let subscription: { remove: () => void } | null = null;
  try {
    if (typeof api?.addEventListener === 'function') subscription = api.addEventListener('reduceTransparencyChanged', apply) ?? null;
  } catch { subscription = null; }
  return () => { live = false; try { subscription?.remove(); } catch { /* nothing to undo */ } };
}

/** Bottom padding under the composer. `keyboardHeight` is the keyboard's
 * height over the window (0 when closed), `bottomInset` the safe-area inset
 * and `occupied` the height of whatever sits below this screen's bottom edge
 * (a tab bar, which already covers the home indicator; 0 in a stack).
 * The composer clears the keyboard or the safe area, whichever is taller,
 * minus what is already occupied, never less than zero. */
export function composerBottomPadding(keyboardHeight: number, bottomInset: number, occupied: number): number {
  return Math.max(Math.max(keyboardHeight, bottomInset) - occupied, 0);
}
