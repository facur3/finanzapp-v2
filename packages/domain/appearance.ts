import type { Account } from './ledger.ts';

/** Presentation identity for financial objects: a curated colour and a curated
 * icon id. Ids are plain strings so the domain stays free of any icon font or
 * React Native; the mobile app maps an id to a glyph and a colour id to a hex
 * pair. Appearance is metadata only: it never enters a balance, a currency, an
 * entry, a transfer or a report. */

export interface AppearanceColor {
  id: string;
  /** Accessible Spanish name for VoiceOver, never "círculo azul". */
  name: string;
  light: string;
  dark: string;
}

/** Eleven restrained colours that read as one family beside the cobalt primary
 * and the four semantic colours. Light values keep at least 3:1 against white
 * for a glyph; dark values keep it against the dark surface. Expense coral is
 * deliberately absent: it carries meaning and is never an identity. */
export const APPEARANCE_COLORS: readonly AppearanceColor[] = [
  { id: 'cobalt', name: 'Cobalto', light: '#2557D6', dark: '#5B87FF' },
  { id: 'azure', name: 'Celeste', light: '#0B6BB3', dark: '#4DB0FF' },
  { id: 'teal', name: 'Verde azulado', light: '#2E8A86', dark: '#4FB8B2' },
  { id: 'green', name: 'Verde', light: '#15804F', dark: '#3DBE86' },
  { id: 'olive', name: 'Oliva', light: '#6F8A3A', dark: '#9DB85C' },
  { id: 'ochre', name: 'Ocre', light: '#A8761F', dark: '#E0B24E' },
  { id: 'terracotta', name: 'Terracota', light: '#C0654A', dark: '#E08A6E' },
  { id: 'rose', name: 'Rosa', light: '#B0507A', dark: '#E07EA6' },
  { id: 'indigo', name: 'Índigo', light: '#6C5BB0', dark: '#9A8CE0' },
  { id: 'slate', name: 'Pizarra', light: '#5B6B7C', dark: '#93A3B4' },
  { id: 'graphite', name: 'Grafito', light: '#4A4A52', dark: '#A8A8B0' },
];
export type AppearanceColorId = typeof APPEARANCE_COLORS[number]['id'];
export const DEFAULT_APPEARANCE_COLOR = 'cobalt';

export function isAppearanceColorId(value: unknown): value is AppearanceColorId {
  return typeof value === 'string' && APPEARANCE_COLORS.some(color => color.id === value);
}
export function appearanceColor(id: string): AppearanceColor {
  return APPEARANCE_COLORS.find(color => color.id === id) ?? APPEARANCE_COLORS[0];
}

export interface AppearanceIcon { id: string; name: string }

/** Icons for liquid accounts: what the money is or where it sits. */
export const ACCOUNT_ICONS: readonly AppearanceIcon[] = [
  { id: 'wallet', name: 'Billetera' },
  { id: 'cash', name: 'Efectivo' },
  { id: 'bank', name: 'Banco' },
  { id: 'digital', name: 'Billetera virtual' },
  { id: 'card', name: 'Tarjeta prepaga' },
  { id: 'savings', name: 'Ahorro' },
  { id: 'investment', name: 'Inversión' },
  { id: 'business', name: 'Negocio' },
  { id: 'safe', name: 'Caja fuerte' },
  { id: 'foreign', name: 'Exterior' },
  { id: 'home', name: 'Hogar' },
  { id: 'shared', name: 'Compartida' },
];
export type AccountIconId = typeof ACCOUNT_ICONS[number]['id'];
export const DEFAULT_ACCOUNT_ICON = 'wallet';
export function isAccountIconId(value: unknown): value is AccountIconId {
  return typeof value === 'string' && ACCOUNT_ICONS.some(icon => icon.id === value);
}

/** Icons for categories: common spending and income concepts, not a font browser. */
export const CATEGORY_ICONS: readonly AppearanceIcon[] = [
  { id: 'food', name: 'Comida' },
  { id: 'groceries', name: 'Supermercado' },
  { id: 'restaurant', name: 'Restaurantes' },
  { id: 'cafe', name: 'Café' },
  { id: 'drinks', name: 'Bebidas' },
  { id: 'transport', name: 'Transporte' },
  { id: 'fuel', name: 'Combustible' },
  { id: 'plane', name: 'Viajes' },
  { id: 'home', name: 'Hogar' },
  { id: 'rent', name: 'Alquiler' },
  { id: 'utilities', name: 'Servicios' },
  { id: 'internet', name: 'Internet' },
  { id: 'phone', name: 'Celular' },
  { id: 'subscriptions', name: 'Suscripciones' },
  { id: 'health', name: 'Salud' },
  { id: 'pharmacy', name: 'Farmacia' },
  { id: 'fitness', name: 'Deporte' },
  { id: 'beauty', name: 'Belleza' },
  { id: 'education', name: 'Educación' },
  { id: 'clothing', name: 'Ropa' },
  { id: 'tech', name: 'Tecnología' },
  { id: 'leisure', name: 'Ocio' },
  { id: 'music', name: 'Música' },
  { id: 'games', name: 'Juegos' },
  { id: 'pets', name: 'Mascotas' },
  { id: 'gifts', name: 'Regalos' },
  { id: 'family', name: 'Familia' },
  { id: 'taxes', name: 'Impuestos' },
  { id: 'insurance', name: 'Seguros' },
  { id: 'bank', name: 'Banco' },
  { id: 'work', name: 'Trabajo' },
  { id: 'sales', name: 'Ventas' },
  { id: 'investment', name: 'Inversiones' },
  { id: 'refund', name: 'Reembolsos' },
  { id: 'loan', name: 'Préstamos' },
  { id: 'repairs', name: 'Reparaciones' },
  { id: 'other', name: 'Otros' },
];
export type CategoryIconId = typeof CATEGORY_ICONS[number]['id'];
export const DEFAULT_CATEGORY_ICON = 'other';
export function isCategoryIconId(value: unknown): value is CategoryIconId {
  return typeof value === 'string' && CATEGORY_ICONS.some(icon => icon.id === value);
}

/** The chosen look of one liquid account. A profile beside the account, like a
 * card or a debt profile: the `accounts` row, its balance, its audit and its
 * backup shape are untouched. An account without a row shows the default look. */
export interface AccountAppearance {
  accountId: string;
  icon: AccountIconId;
  color: AppearanceColorId;
  createdAt: string;
  revision: number;
  updatedAt: string;
}

export const APPEARANCE_KEYS = ['accountId', 'icon', 'color', 'createdAt', 'revision', 'updatedAt'] as const;

function validId(value: string): boolean {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}
function validTimestamp(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
export function validateVersionedRecord(createdAt: string, revision: number, updatedAt: string, what = 'registro'): void {
  if (!validTimestamp(createdAt) || !validTimestamp(updatedAt) || !Number.isSafeInteger(revision) || revision < 0) {
    throw new Error(`Estado de ${what} inválido.`);
  }
  if (revision === 0 && createdAt !== updatedAt) throw new Error(`Estado inicial de ${what} inválido.`);
}

export function validateAccountAppearance(appearance: AccountAppearance, accounts: Account[]): void {
  if (!validId(appearance.accountId)) throw new Error('Identificador de cuenta inválido.');
  if (!accounts.some(account => account.id === appearance.accountId)) throw new Error('La apariencia debe pertenecer a una cuenta existente.');
  if (!isAccountIconId(appearance.icon)) throw new Error('Elegí un ícono de cuenta de la lista.');
  if (!isAppearanceColorId(appearance.color)) throw new Error('Elegí un color de la paleta.');
  validateVersionedRecord(appearance.createdAt, appearance.revision, appearance.updatedAt, 'apariencia');
}

/** One look per account; every referenced account exists. */
export function validateAccountAppearances(appearances: AccountAppearance[], accounts: Account[]): void {
  const seen = new Set<string>();
  for (const appearance of appearances) {
    validateAccountAppearance(appearance, accounts);
    if (seen.has(appearance.accountId)) throw new Error('La copia repite la apariencia de una cuenta.');
    seen.add(appearance.accountId);
  }
}

export function sameAccountAppearance(a: AccountAppearance, b: AccountAppearance): boolean {
  return APPEARANCE_KEYS.every(key => a[key] === b[key]);
}

/** The look to show: the stored one, or the default (wallet on cobalt) for an
 * account that never chose one. Existing accounts migrate by reading this;
 * nothing is written for them. */
export function accountLook(accountId: string, appearances: AccountAppearance[] = []): { icon: AccountIconId; color: AppearanceColorId } {
  const found = appearances.find(item => item.accountId === accountId);
  return found ? { icon: found.icon, color: found.color } : { icon: DEFAULT_ACCOUNT_ICON, color: DEFAULT_APPEARANCE_COLOR };
}

/** A first look for a new account, or the next revision of an existing one.
 * Never touches the account row. */
export function makeAccountAppearance(accountId: string, icon: AccountIconId, color: AppearanceColorId, now: string, current?: AccountAppearance): AccountAppearance {
  return current ? { ...current, icon, color, revision: current.revision + 1, updatedAt: now }
    : { accountId, icon, color, createdAt: now, revision: 0, updatedAt: now };
}
