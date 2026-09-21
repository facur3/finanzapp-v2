/** Pure decisions behind the glass material and the composer's keyboard
 * geometry, free of React Native so they run in Node.
 *
 * Liquid Glass is a control layer, not a content layer: it is drawn only on
 * the four Home actions and the Assistant composer, and only when every
 * condition holds. Everything else, and every other case, gets the opaque
 * material from Producto 21, which is a designed state, not a fallback error. */
export type GlassConditions = {
  /** `Platform.OS`: only iOS draws glass. */
  platform: string;
  /** `isLiquidGlassAvailable()`: iOS 26+, built with a Liquid Glass SDK, no compatibility flag. */
  liquidGlass: boolean;
  /** `isGlassEffectAPIAvailable()`: some iOS 26 betas lack the API and crash without this guard. */
  apiAvailable: boolean;
  /** The user's Reduce Transparency setting, or `true` until iOS has answered. */
  reduceTransparency: boolean;
};

export type Material = 'glass' | 'opaque';

export function materialFor({ platform, liquidGlass, apiAvailable, reduceTransparency }: GlassConditions): Material {
  return platform === 'ios' && liquidGlass && apiAvailable && !reduceTransparency ? 'glass' : 'opaque';
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
