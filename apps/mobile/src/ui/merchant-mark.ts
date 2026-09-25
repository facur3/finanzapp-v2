import { resolveMerchant, type MerchantBrand } from '@finanzapp/domain';

/** What a row draws in its leading tile for a merchant (Producto 24UX2).
 *
 * The category glyph is the production presentation, for every merchant. The
 * merchant identity (`@finanzapp/domain` merchants.ts) is typed metadata kept
 * for later features; showing brands is deferred to Producto 25C2, which must
 * settle licence, privacy, maintenance and visual coherence first
 * (docs/merchant-identity.md). This module draws no logo: no bundled brand
 * asset, no user upload, no provider, no key, no network.
 *
 * The only other mark is a development preview (a brand's initial on a
 * neutral tile) that shows on the iPhone which typed names the catalogue
 * recognizes. It needs no asset and no dependency, and a release or preview
 * build (`__DEV__` false) never draws it.
 *
 * Pure (no React Native), so Node tests load it directly. */

export type MerchantMark =
  /** Development preview only: the recognized brand's initial. */
  | { kind: 'monogram'; brand: MerchantBrand; letter: string }
  | { kind: 'category' };

const CATEGORY: MerchantMark = { kind: 'category' };

/** The mark for a typed merchant name: the category glyph, unless the
 * development preview is on and the name is a recognized brand. */
export function merchantMark(name: string, preview = false): MerchantMark {
  if (!preview) return CATEGORY;
  const identity = resolveMerchant(name);
  return identity.status === 'recognized' ? { kind: 'monogram', brand: identity.brand, letter: identity.brand.name.charAt(0).toUpperCase() } : CATEGORY;
}

export const MERCHANT_MARK_PREVIEW_FLAG = 'EXPO_PUBLIC_MERCHANT_MARK_PREVIEW';

/** The preview exists only in a development bundle started with the flag. */
export function merchantMarkPreview(flag: string | undefined, dev: boolean): boolean {
  return dev && flag === '1';
}

/** This bundle's choice, read once. */
export const BUILD_MERCHANT_MARK_PREVIEW = merchantMarkPreview(
  typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_MERCHANT_MARK_PREVIEW : undefined,
  typeof __DEV__ !== 'undefined' && __DEV__);
