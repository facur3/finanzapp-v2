import { resolveMerchant, type MerchantBrand } from '@finanzapp/domain';

/** What a row draws in its leading tile for a merchant (Producto 24UX2).
 *
 * The merchant identity (`@finanzapp/domain` merchants.ts) says whether a typed
 * name is a recognized brand; this adapter decides what, if anything, can be
 * drawn for it. The order is fixed: a licensed logo from the configured
 * provider, else the category glyph the row always had. The category is never
 * replaced as data, only as the picture in the tile, and the row keeps the
 * category name in its caption.
 *
 * No provider is configured in this build: `NO_LOGOS` answers null for every
 * brand, so every row draws its category glyph exactly as before. A real
 * provider needs the review in docs/merchant-identity.md (coverage, licence,
 * attribution, cache, privacy, cost) and the owner's decision; it must not put a
 * key in the bundle nor send the person's merchant list to a third party.
 *
 * Pure (no React Native), so Node tests load it directly. */

export type LogoScheme = 'light' | 'dark';

/** A logo a provider can hand over. Only an https URI or a bundled asset id
 * is accepted; anything else falls back to the category glyph. */
export interface MerchantLogo {
  source: { uri: string } | number;
  /** The provider's required credit, shown where the provider's terms say, or null. */
  attribution: string | null;
}

export interface MerchantLogoProvider {
  readonly id: string;
  logoFor(brand: MerchantBrand, scheme: LogoScheme): MerchantLogo | null;
}

/** The provider of this build: none. */
export const NO_LOGOS: MerchantLogoProvider = { id: 'none', logoFor: () => null };

export type MerchantMark =
  | { kind: 'logo'; brand: MerchantBrand; logo: MerchantLogo }
  /** Development preview only: the brand's initial on a neutral tile, to judge a recognized row on the iPhone without any logo. */
  | { kind: 'monogram'; brand: MerchantBrand; letter: string }
  | { kind: 'category' };

const CATEGORY: MerchantMark = { kind: 'category' };

function usableLogo(logo: MerchantLogo | null): logo is MerchantLogo {
  if (!logo) return false;
  if (typeof logo.source === 'number') return Number.isInteger(logo.source) && logo.source > 0;
  return typeof logo.source?.uri === 'string' && /^https:\/\/[^\s]+$/.test(logo.source.uri);
}

/** The mark for a typed merchant name. An unrecognized name, a provider with
 * nothing to offer, a provider that fails or an unusable source all give the
 * category glyph. */
export function merchantMark(name: string, provider: MerchantLogoProvider = NO_LOGOS, scheme: LogoScheme = 'light', preview = false): MerchantMark {
  const identity = resolveMerchant(name);
  if (identity.status !== 'recognized') return CATEGORY;
  let logo: MerchantLogo | null = null;
  try { logo = provider.logoFor(identity.brand, scheme); } catch { logo = null; }
  if (usableLogo(logo)) return { kind: 'logo', brand: identity.brand, logo };
  if (preview) return { kind: 'monogram', brand: identity.brand, letter: identity.brand.name.charAt(0).toUpperCase() };
  return CATEGORY;
}

export const MERCHANT_MARK_PREVIEW_FLAG = 'EXPO_PUBLIC_MERCHANT_MARK_PREVIEW';

/** The monogram preview exists only in a development bundle started with the
 * flag; a release or preview build (`__DEV__` false) never draws it. */
export function merchantMarkPreview(flag: string | undefined, dev: boolean): boolean {
  return dev && flag === '1';
}

/** This bundle's choices, read once. */
export const BUILD_LOGO_PROVIDER: MerchantLogoProvider = NO_LOGOS;
export const BUILD_MERCHANT_MARK_PREVIEW = merchantMarkPreview(
  typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_MERCHANT_MARK_PREVIEW : undefined,
  typeof __DEV__ !== 'undefined' && __DEV__);
