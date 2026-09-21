import { categoryKey } from './spending-report.ts';
import type { Entry, EntryKind } from './ledger.ts';
import { isAppearanceColorId, isCategoryIconId, validateVersionedRecord, type AppearanceColorId, type CategoryIconId } from './appearance.ts';

/** Category identity model.
 *
 * A movement stores a free category string (`Entry.category`) and always will:
 * the ledger, budgets, recurring rules, reports and every backup keep grouping
 * by `categoryKey(string)` (case, accents and spacing folded). This module adds
 * presentation on top of that key, never a rewrite under it.
 *
 * - The identity of a category is `(kind, key)`.
 * - A **preset** is a built-in identity with a label, icon and colour, kept in
 *   code so nothing is seeded into the database or the backup.
 * - A **definition** is a stored row for the same `(kind, key)` that decorates
 *   it: display label, icon, colour, archived. A definition may override a
 *   preset, describe a custom category the user created, or adopt a historical
 *   string the user typed before this existed.
 * - `storedLabel` is the exact string written into new movements. It is fixed
 *   at creation so its key never changes; renaming only changes `label`, the
 *   display name. A category renamed from "Comida" to "Alimentación" keeps
 *   recording "Comida", so every past and future movement resolves to the same
 *   `(expense, comida)` and reports never split one category into two.
 * - A string with no definition and no preset is **historical**: it renders as
 *   stored, with a deterministic fallback icon and hue chosen by the app. */
export interface CategoryDefinition {
  kind: EntryKind;
  key: string;
  storedLabel: string;
  label: string;
  icon: CategoryIconId;
  color: AppearanceColorId;
  archived: boolean;
  createdAt: string;
  revision: number;
  updatedAt: string;
}

export const CATEGORY_DEFINITION_KEYS = ['kind', 'key', 'storedLabel', 'label', 'icon', 'color', 'archived', 'createdAt', 'revision', 'updatedAt'] as const;

export interface CategoryPreset { kind: EntryKind; key: string; label: string; icon: CategoryIconId; color: AppearanceColorId }

const preset = (kind: EntryKind, label: string, icon: CategoryIconId, color: AppearanceColorId): CategoryPreset =>
  ({ kind, key: categoryKey(label), label, icon, color });

/** The restrained default catalogue. Order is the order shown. */
export const CATEGORY_PRESETS: readonly CategoryPreset[] = [
  preset('expense', 'Comida', 'food', 'terracotta'),
  preset('expense', 'Supermercado', 'groceries', 'olive'),
  preset('expense', 'Restaurantes', 'restaurant', 'rose'),
  preset('expense', 'Transporte', 'transport', 'cobalt'),
  preset('expense', 'Combustible', 'fuel', 'slate'),
  preset('expense', 'Hogar', 'home', 'ochre'),
  preset('expense', 'Alquiler', 'rent', 'indigo'),
  preset('expense', 'Servicios', 'utilities', 'azure'),
  preset('expense', 'Suscripciones', 'subscriptions', 'indigo'),
  preset('expense', 'Salud', 'health', 'teal'),
  preset('expense', 'Farmacia', 'pharmacy', 'green'),
  preset('expense', 'Educación', 'education', 'cobalt'),
  preset('expense', 'Ropa', 'clothing', 'rose'),
  preset('expense', 'Tecnología', 'tech', 'graphite'),
  preset('expense', 'Ocio', 'leisure', 'terracotta'),
  preset('expense', 'Viajes', 'plane', 'azure'),
  preset('expense', 'Mascotas', 'pets', 'olive'),
  preset('expense', 'Regalos', 'gifts', 'rose'),
  preset('expense', 'Impuestos', 'taxes', 'slate'),
  preset('expense', 'Seguros', 'insurance', 'teal'),
  preset('expense', 'Otros', 'other', 'graphite'),
  preset('income', 'Sueldo', 'work', 'green'),
  preset('income', 'Trabajo', 'tech', 'teal'),
  preset('income', 'Ventas', 'sales', 'ochre'),
  preset('income', 'Inversiones', 'investment', 'cobalt'),
  preset('income', 'Regalos', 'gifts', 'rose'),
  preset('income', 'Reembolsos', 'refund', 'azure'),
  preset('income', 'Préstamos', 'loan', 'indigo'),
  preset('income', 'Otros', 'other', 'graphite'),
];

export function categoryPreset(kind: EntryKind, key: string): CategoryPreset | undefined {
  return CATEGORY_PRESETS.find(item => item.kind === kind && item.key === key);
}

export type CategorySource = 'preset' | 'custom' | 'historical';

/** Everything a screen needs to show one category. `icon` and `color` are null
 * for a historical string, which the app resolves to a deterministic fallback. */
export interface CategoryIdentity {
  kind: EntryKind;
  key: string;
  /** Display name. */
  label: string;
  /** The string to write into a new movement. */
  storedLabel: string;
  icon: CategoryIconId | null;
  color: AppearanceColorId | null;
  archived: boolean;
  source: CategorySource;
  /** The stored definition behind this identity, when one exists. */
  definition: CategoryDefinition | null;
}

export function findCategoryDefinition(kind: EntryKind, key: string, definitions: CategoryDefinition[] = []): CategoryDefinition | undefined {
  return definitions.find(item => item.kind === kind && item.key === key);
}

/** Resolve a stored category string (or a label) to its identity. Pure lookup:
 * the string is never edited. */
export function resolveCategory(kind: EntryKind, stored: string, definitions: CategoryDefinition[] = []): CategoryIdentity {
  const key = categoryKey(stored);
  const definition = findCategoryDefinition(kind, key, definitions);
  const built = categoryPreset(kind, key);
  if (definition) {
    return { kind, key, label: definition.label, storedLabel: definition.storedLabel, icon: definition.icon, color: definition.color,
      archived: definition.archived, source: built ? 'preset' : 'custom', definition };
  }
  if (built) return { kind, key, label: built.label, storedLabel: built.label, icon: built.icon, color: built.color, archived: false, source: 'preset', definition: null };
  const trimmed = stored.trim();
  return { kind, key, label: trimmed, storedLabel: trimmed, icon: null, color: null, archived: false, source: 'historical', definition: null };
}

function validLabel(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= 60 && value === value.trim();
}

export function validateCategoryDefinition(definition: CategoryDefinition): void {
  if (definition.kind !== 'expense' && definition.kind !== 'income') throw new Error('Elegí si la categoría es de gasto o de ingreso.');
  if (!validLabel(definition.storedLabel) || !validLabel(definition.label)) throw new Error('Ingresá un nombre de categoría de hasta 60 caracteres.');
  if (typeof definition.key !== 'string' || !definition.key || definition.key !== categoryKey(definition.storedLabel)) {
    throw new Error('La identidad de la categoría no coincide con su nombre registrado.');
  }
  if (!isCategoryIconId(definition.icon)) throw new Error('Elegí un ícono de categoría de la lista.');
  if (!isAppearanceColorId(definition.color)) throw new Error('Elegí un color de la paleta.');
  if (typeof definition.archived !== 'boolean') throw new Error('Estado de categoría inválido.');
  validateVersionedRecord(definition.createdAt, definition.revision, definition.updatedAt, 'categoría');
}

/** One definition per identity, and display names that cannot be confused:
 * within a kind, no two definitions show the same name, and a display name
 * never reads as another identity (its own key, another definition's key or a
 * preset's key). Archived definitions keep their names reserved. */
export function validateCategoryDefinitions(definitions: CategoryDefinition[]): void {
  const identities = new Set<string>();
  for (const definition of definitions) {
    validateCategoryDefinition(definition);
    const identity = definition.kind + '|' + definition.key;
    if (identities.has(identity)) throw new Error('La copia repite una categoría.');
    identities.add(identity);
  }
  for (const kind of ['expense', 'income'] as const) {
    const own = definitions.filter(definition => definition.kind === kind);
    const names = new Set<string>();
    for (const definition of own) {
      const name = categoryKey(definition.label);
      if (names.has(name)) throw new Error(`Ya existe una categoría llamada «${definition.label}».`);
      names.add(name);
      if (name === definition.key) continue;
      if (own.some(other => other !== definition && other.key === name) || categoryPreset(kind, name)) {
        throw new Error(`«${definition.label}» ya es el nombre de otra categoría.`);
      }
    }
  }
}

export function sameCategoryDefinition(a: CategoryDefinition, b: CategoryDefinition): boolean {
  return CATEGORY_DEFINITION_KEYS.every(key => a[key] === b[key]);
}

/** A brand-new custom category. Its stored spelling is the name as typed. */
export function newCategoryDefinition(kind: EntryKind, label: string, icon: CategoryIconId, color: AppearanceColorId, now: string): CategoryDefinition {
  const trimmed = label.trim();
  return { kind, key: categoryKey(trimmed), storedLabel: trimmed, label: trimmed, icon, color, archived: false, createdAt: now, revision: 0, updatedAt: now };
}

/** The definition to save after editing an identity: the next revision of its
 * definition, or a first definition that adopts a preset or a historical
 * string (its stored spelling stays what movements already carry). */
export function editedCategoryDefinition(identity: CategoryIdentity, changes: Partial<Pick<CategoryDefinition, 'label' | 'icon' | 'color' | 'archived'>>, now: string): CategoryDefinition {
  const base: CategoryDefinition = identity.definition ?? {
    kind: identity.kind, key: identity.key, storedLabel: identity.storedLabel, label: identity.label,
    icon: identity.icon ?? 'other', color: identity.color ?? 'graphite', archived: false, createdAt: now, revision: 0, updatedAt: now,
  };
  const next = { ...base, ...changes, label: (changes.label ?? base.label).trim() };
  return identity.definition ? { ...next, revision: base.revision + 1, updatedAt: now } : next;
}

/** Whether a name is already taken within a kind (as a preset, a definition's
 * name or a definition's identity). Used before creating a new category. */
export function categoryNameTaken(kind: EntryKind, label: string, definitions: CategoryDefinition[] = []): boolean {
  const key = categoryKey(label);
  if (!key) return false;
  if (categoryPreset(kind, key)) return true;
  return definitions.some(definition => definition.kind === kind && (definition.key === key || categoryKey(definition.label) === key));
}

/** Everything the app knows for one kind: presets (possibly decorated),
 * custom definitions, and the historical strings recorded on entries, each
 * with its usage count. Nothing here edits an entry. */
export interface CategoryCatalogRow { identity: CategoryIdentity; count: number }

export function categoryCatalog(kind: EntryKind, definitions: CategoryDefinition[] = [], entries: Entry[] = []): CategoryCatalogRow[] {
  const counts = new Map<string, number>();
  const spellings = new Map<string, string>();
  const recent = new Map<string, string>();
  for (const entry of entries) {
    if (entry.kind !== kind) continue;
    const key = categoryKey(entry.category);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const stamp = entry.dateISO + '|' + entry.createdAt;
    if ((recent.get(key) ?? '') < stamp) { recent.set(key, stamp); spellings.set(key, entry.category.trim()); }
  }
  const rows: CategoryCatalogRow[] = [];
  const seen = new Set<string>();
  const push = (stored: string) => {
    const identity = resolveCategory(kind, stored, definitions);
    if (seen.has(identity.key)) return;
    seen.add(identity.key);
    rows.push({ identity, count: counts.get(identity.key) ?? 0 });
  };
  for (const item of CATEGORY_PRESETS) if (item.kind === kind) push(item.label);
  definitions.filter(definition => definition.kind === kind && !seen.has(definition.key))
    .sort((a, b) => a.label.localeCompare(b.label, 'es')).forEach(definition => push(definition.storedLabel));
  [...spellings.entries()].filter(([key]) => !seen.has(key))
    .sort((a, b) => (counts.get(b[0]) ?? 0) - (counts.get(a[0]) ?? 0) || a[1].localeCompare(b[1], 'es')).forEach(([, stored]) => push(stored));
  return rows;
}

/** Choices for a picker: the current value first (even if archived, so an old
 * movement stays valid), then recorded categories most recent first, then the
 * rest of the catalogue. Archived identities are otherwise excluded. */
export function categoryOptions(kind: EntryKind, definitions: CategoryDefinition[] = [], entries: Entry[] = [], query = '', selected = ''): CategoryIdentity[] {
  const options = new Map<string, CategoryIdentity>();
  const add = (stored: string, force = false) => {
    const identity = resolveCategory(kind, stored, definitions);
    if (!identity.key || options.has(identity.key) || (identity.archived && !force)) return;
    options.set(identity.key, identity);
  };
  if (selected.trim()) add(selected, true);
  entries.filter(entry => entry.kind === kind).slice()
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.createdAt.localeCompare(a.createdAt)).forEach(entry => add(entry.category));
  for (const row of categoryCatalog(kind, definitions)) add(row.identity.storedLabel);
  const terms = categoryKey(query).split(' ').filter(Boolean);
  return [...options.values()].filter(identity => terms.every(term => categoryKey(identity.label).includes(term) || identity.key.includes(term)));
}

/** A new name typed into the picker, when it is not already one of the choices
 * (by display name or identity) and not an archived category. */
export function customCategoryName(kind: EntryKind, query: string, options: CategoryIdentity[], definitions: CategoryDefinition[] = []): string | null {
  const value = query.trim();
  const key = categoryKey(value);
  if (!key || value.length > 60) return null;
  if (options.some(identity => identity.key === key || categoryKey(identity.label) === key)) return null;
  if (findCategoryDefinition(kind, key, definitions)?.archived) return null;
  return value;
}
