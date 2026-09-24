import { categoryKey, categoryOptions, customCategoryName, resolveCategory, type CategoryDefinition, type CategoryIdentity, type Entry, type EntryKind } from '@finanzapp/domain';
import { identityGlyph, localizeCategory, localizedCategoryLabel, type IconName } from './appearance.ts';
import { DEFAULT_LANGUAGE, type LanguageCode } from '../i18n/locale.ts';
export { categoryKey } from '@finanzapp/domain';
export type { CategoryIdentity } from '@finanzapp/domain';
export type { IconName } from './appearance.ts';
export { identityGlyph, localizeCategory, localizedCategoryLabel, resolveCategoryLook } from './appearance.ts';

/** Glyph for a stored string: its identity's curated icon, the historical
 * synonym map, or a plain tag. The string itself is never edited. */
export function categoryIcon(label: string, kind: EntryKind = 'expense', definitions: CategoryDefinition[] = []): IconName {
  return identityGlyph(resolveCategory(kind, label, definitions));
}

/** Picker choices as identities: current value first, recorded most recent first, then the catalogue.
 * Labels are in the interface language, and the search matches the name shown, the Spanish name and the
 * identity key, so "food" and "comida" both find the built-in Comida whatever the language. */
export function categoryChoices(entries: Entry[], kind: EntryKind, query = '', selected = '', definitions: CategoryDefinition[] = [],
  language: LanguageCode = DEFAULT_LANGUAGE): CategoryIdentity[] {
  const terms = categoryKey(query).split(' ').filter(Boolean);
  return categoryOptions(kind, definitions, entries, '', selected).flatMap(identity => {
    const shown = localizeCategory(identity, language);
    const names = [categoryKey(shown.label), categoryKey(identity.label), identity.key];
    return terms.every(term => names.some(name => name.includes(term))) ? [shown] : [];
  });
}

/** A name typed into the picker that is not already a choice. Recording it
 * stores the string; a look can be given to it later from Categorías. */
export function customCategory(query: string, choices: CategoryIdentity[], kind: EntryKind = 'expense', definitions: CategoryDefinition[] = []): string | null {
  return customCategoryName(kind, query, choices, definitions);
}

/** Search text for a stored category: its display name (in the interface language) plus the stored spelling when they differ. */
export function categorySearchText(kind: EntryKind, stored: string, definitions: CategoryDefinition[] = [], language: LanguageCode = DEFAULT_LANGUAGE): string {
  const label = localizedCategoryLabel(resolveCategory(kind, stored, definitions), language);
  return label === stored.trim() ? label : label + ' ' + stored;
}

export { resolveCategory };
export const sameCategory = (a: string, b: string) => categoryKey(a) === categoryKey(b);
