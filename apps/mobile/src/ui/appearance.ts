import { ACCOUNT_ICONS, APPEARANCE_COLORS, CATEGORY_ICONS, DEFAULT_ACCOUNT_ICON, DEFAULT_APPEARANCE_COLOR, DEFAULT_CATEGORY_ICON,
  accountLook, appearanceColor, categoryPreset, resolveCategory, type AccountAppearance, type AccountIconId, type AppearanceColorId, type CategoryDefinition,
  type CategoryIconId, type CategoryIdentity, type EntryKind } from '@finanzapp/domain';
import type Ionicons from '@expo/vector-icons/Ionicons';
import { categoryColor } from './category-color.ts';
import { translate, type MessageKey } from '../i18n/messages.ts';
import { DEFAULT_LANGUAGE, type LanguageCode } from '../i18n/locale.ts';

export type IconName = keyof typeof Ionicons.glyphMap;

/** The bridge between the domain's appearance ids and what the app draws:
 * Ionicons glyphs for icon ids, and a hex pair (light/dark) for colour ids.
 * Pure, so tests can check every glyph exists in the font and every colour
 * keeps its contrast. Unknown ids fall back instead of breaking a row. */

const ACCOUNT_GLYPHS: Record<AccountIconId, IconName> = {
  wallet: 'wallet-outline', cash: 'cash-outline', bank: 'business-outline', digital: 'phone-portrait-outline', card: 'card-outline',
  savings: 'shield-checkmark-outline', investment: 'trending-up-outline', business: 'briefcase-outline', safe: 'lock-closed-outline',
  foreign: 'globe-outline', home: 'home-outline', shared: 'people-outline',
};

const CATEGORY_GLYPHS: Record<CategoryIconId, IconName> = {
  food: 'restaurant-outline', groceries: 'cart-outline', restaurant: 'pizza-outline', cafe: 'cafe-outline', drinks: 'wine-outline',
  transport: 'bus-outline', fuel: 'car-outline', plane: 'airplane-outline', home: 'home-outline', rent: 'key-outline',
  utilities: 'flash-outline', internet: 'wifi-outline', phone: 'phone-portrait-outline', subscriptions: 'repeat-outline',
  health: 'medkit-outline', pharmacy: 'bandage-outline', fitness: 'barbell-outline', beauty: 'cut-outline', education: 'school-outline',
  clothing: 'shirt-outline', tech: 'laptop-outline', leisure: 'ticket-outline', music: 'musical-notes-outline', games: 'game-controller-outline',
  pets: 'paw-outline', gifts: 'gift-outline', family: 'people-outline', taxes: 'document-text-outline', insurance: 'shield-checkmark-outline',
  bank: 'business-outline', work: 'briefcase-outline', sales: 'pricetags-outline', investment: 'trending-up-outline', refund: 'return-down-back-outline',
  loan: 'swap-horizontal-outline', repairs: 'construct-outline', other: 'ellipsis-horizontal',
};

export function accountGlyph(id: string): IconName {
  return (ACCOUNT_GLYPHS as Record<string, IconName>)[id] ?? ACCOUNT_GLYPHS[DEFAULT_ACCOUNT_ICON as AccountIconId];
}
export function categoryGlyph(id: string): IconName {
  return (CATEGORY_GLYPHS as Record<string, IconName>)[id] ?? CATEGORY_GLYPHS[DEFAULT_CATEGORY_ICON as CategoryIconId];
}

/** Hex for a colour id in the current theme; an unknown id shows the default. */
export function appearanceHex(id: string, p: { isDark: boolean }): string {
  const color = appearanceColor(id);
  return p.isDark ? color.dark : color.light;
}
export function appearanceName(id: string): string {
  return appearanceColor(id).name;
}

export type IconChoice = { id: string; glyph: IconName; name: string };
export type ColorChoice = { id: string; name: string };

/** What the picker lists, in catalogue order. */
export const ACCOUNT_ICON_CHOICES: readonly IconChoice[] = ACCOUNT_ICONS.map(icon => ({ id: icon.id, glyph: accountGlyph(icon.id), name: icon.name }));
export const CATEGORY_ICON_CHOICES: readonly IconChoice[] = CATEGORY_ICONS.map(icon => ({ id: icon.id, glyph: categoryGlyph(icon.id), name: icon.name }));
export const COLOR_CHOICES: readonly ColorChoice[] = APPEARANCE_COLORS.map(color => ({ id: color.id, name: color.name }));

export const DEFAULT_LOOK = { icon: DEFAULT_ACCOUNT_ICON as AccountIconId, color: DEFAULT_APPEARANCE_COLOR as AppearanceColorId };

// Deterministic glyphs for historical strings that have no definition and no
// preset: a synonym map over the normalised key, so "delivery" or "nafta"
// recorded before Producto 20 still get a sensible monochrome glyph. Never
// emoji. The user's category string in the ledger is never edited.
const historicalGlyphs = new Map<string, IconName>(Object.entries({
  comidas: 'restaurant-outline', alimentacion: 'restaurant-outline', restaurante: 'restaurant-outline', delivery: 'bicycle-outline',
  'fast food': 'fast-food-outline', pizza: 'pizza-outline', cafe: 'cafe-outline', cafeteria: 'cafe-outline', bebidas: 'wine-outline', bar: 'beer-outline',
  supermercados: 'cart-outline', super: 'cart-outline', almacen: 'basket-outline', compras: 'bag-outline', shopping: 'bag-outline',
  nafta: 'car-outline', auto: 'car-outline', taxi: 'car-outline', uber: 'car-outline', vivienda: 'home-outline', expensas: 'business-outline', muebles: 'bed-outline',
  luz: 'flash-outline', gas: 'flame-outline', agua: 'water-outline', internet: 'wifi-outline', celular: 'phone-portrait-outline', telefono: 'phone-portrait-outline',
  medico: 'medkit-outline', indumentaria: 'shirt-outline', belleza: 'cut-outline', entretenimiento: 'ticket-outline', cine: 'film-outline',
  musica: 'musical-notes-outline', juegos: 'game-controller-outline', suscripcion: 'repeat-outline', streaming: 'tv-outline',
  libros: 'book-outline', cursos: 'school-outline', vacaciones: 'airplane-outline', hotel: 'bed-outline', deporte: 'barbell-outline', deportes: 'barbell-outline',
  gimnasio: 'barbell-outline', bancos: 'business-outline', comisiones: 'business-outline', regalo: 'gift-outline', hijos: 'people-outline', familia: 'people-outline',
  salario: 'briefcase-outline', freelance: 'laptop-outline', honorarios: 'briefcase-outline', reembolso: 'return-down-back-outline', prestamo: 'people-outline',
  intereses: 'trending-up-outline',
}));

/** The glyph for a category identity: its curated icon when it has one, else
 * the synonym map for a historical string, else a plain tag. */
export function identityGlyph(identity: Pick<CategoryIdentity, 'icon' | 'key'>): IconName {
  if (identity.icon) return categoryGlyph(identity.icon);
  return historicalGlyphs.get(identity.key) ?? 'pricetag-outline';
}

/** The name a category shows in the interface language. Only a built-in
 * category the person has not renamed is translated ("Comida" reads "Food"):
 * its identity key, the string its movements store, its budgets and its
 * history stay exactly the same, so nothing splits or moves. A renamed preset,
 * a custom category and a historical string are the person's own words and
 * read the same in every language. */
export function localizedCategoryLabel(identity: CategoryIdentity, language: LanguageCode = DEFAULT_LANGUAGE): string {
  if (identity.source !== 'preset') return identity.label;
  const preset = categoryPreset(identity.kind, identity.key);
  if (!preset || (identity.definition && identity.definition.label !== preset.label)) return identity.label;
  const key = `categories.${identity.kind}.${identity.key}` as MessageKey;
  const text = translate(language, key);
  return text === key ? identity.label : text;
}

/** The identity with its display label in the interface language; everything else, `storedLabel` included, untouched. */
export function localizeCategory<T extends CategoryIdentity>(identity: T, language: LanguageCode = DEFAULT_LANGUAGE): T {
  const label = localizedCategoryLabel(identity, language);
  return label === identity.label ? identity : { ...identity, label };
}

export type CategoryLook = CategoryIdentity & { glyph: IconName; hex: string };
export type AccountLook = { icon: string; color: string; glyph: IconName; hex: string };

/** Everything to draw one category: display label, glyph and hex colour. A
 * definition or preset gives label, icon and colour; a historical string keeps
 * its stored label, a synonym glyph and one of the muted hues assigned by
 * first use, so an old category never changes colour because a new one appeared. */
export function resolveCategoryLook(kind: EntryKind, stored: string, identity: { definitions: CategoryDefinition[]; hues: Map<string, number> }, p: { isDark: boolean },
  language: LanguageCode = DEFAULT_LANGUAGE): CategoryLook {
  const resolved = localizeCategory(resolveCategory(kind, stored, identity.definitions), language);
  return { ...resolved, glyph: identityGlyph(resolved),
    hex: resolved.color ? appearanceHex(resolved.color, p) : categoryColor(stored, identity.hues, p) };
}

/** The look of a liquid account: the stored choice, else wallet on cobalt. */
export function resolveAccountLook(accountId: string, appearances: AccountAppearance[], p: { isDark: boolean }): AccountLook {
  const look = accountLook(accountId, appearances);
  return { ...look, glyph: accountGlyph(look.icon), hex: appearanceHex(look.color, p) };
}

/** Más → Finanzas: a soft, meaningful identity per row, from the same palette
 * accounts and categories use, so the hub reads as one system. */
export const FINANCE_ROW_LOOKS: Record<'accounts' | 'cards' | 'budgets' | 'recurring' | 'debts' | 'categories', { glyph: IconName; color: AppearanceColorId }> = {
  accounts: { glyph: 'wallet-outline', color: 'cobalt' },
  cards: { glyph: 'card-outline', color: 'graphite' },
  budgets: { glyph: 'speedometer-outline', color: 'teal' },
  recurring: { glyph: 'repeat-outline', color: 'indigo' },
  debts: { glyph: 'people-outline', color: 'ochre' },
  categories: { glyph: 'pricetags-outline', color: 'slate' },
};
