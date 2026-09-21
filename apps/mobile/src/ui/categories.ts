import { categoryKey, categoryOptions, customCategoryName, resolveCategory, type CategoryDefinition, type CategoryIdentity, type Entry, type EntryKind } from '@finanzapp/domain';
import { identityGlyph, type IconName } from './appearance.ts';
export { categoryKey } from '@finanzapp/domain';
export type { CategoryIdentity } from '@finanzapp/domain';
export type { IconName } from './appearance.ts';
export { identityGlyph, resolveCategoryLook } from './appearance.ts';

/** Glyph for a stored string: its identity's curated icon, the historical
 * synonym map, or a plain tag. The string itself is never edited. */
export function categoryIcon(label: string, kind: EntryKind = 'expense', definitions: CategoryDefinition[] = []): IconName {
  return identityGlyph(resolveCategory(kind, label, definitions));
}

/** Picker choices as identities: current value first, recorded most recent first, then the catalogue. */
export function categoryChoices(entries: Entry[], kind: EntryKind, query = '', selected = '', definitions: CategoryDefinition[] = []): CategoryIdentity[] {
  return categoryOptions(kind, definitions, entries, query, selected);
}

/** A name typed into the picker that is not already a choice. Recording it
 * stores the string; a look can be given to it later from Categorías. */
export function customCategory(query: string, choices: CategoryIdentity[], kind: EntryKind = 'expense', definitions: CategoryDefinition[] = []): string | null {
  return customCategoryName(kind, query, choices, definitions);
}

/** Search text for a stored category: its display name plus the stored spelling when they differ. */
export function categorySearchText(kind: EntryKind, stored: string, definitions: CategoryDefinition[] = []): string {
  const identity = resolveCategory(kind, stored, definitions);
  return identity.label === stored.trim() ? identity.label : identity.label + ' ' + stored;
}

export { resolveCategory };
export const sameCategory = (a: string, b: string) => categoryKey(a) === categoryKey(b);
