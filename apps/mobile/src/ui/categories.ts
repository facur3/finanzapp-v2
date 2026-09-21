import { categoryKey, type Entry, type EntryKind } from '@finanzapp/domain';
import type Ionicons from '@expo/vector-icons/Ionicons';
export { categoryKey } from '@finanzapp/domain';

export type IconName = keyof typeof Ionicons.glyphMap;

// Interface choices, not seeded transactions or an automatic reclassification.
// Keep the user's category string in the ledger, including custom categories.
const expenseLabels = ['Comida', 'Supermercado', 'Transporte', 'Hogar', 'Servicios', 'Salud', 'Ropa', 'Ocio', 'Educación', 'Viajes', 'Mascotas', 'Otros'];
const incomeLabels = ['Sueldo', 'Trabajo', 'Regalos', 'Reembolsos', 'Préstamos', 'Otros'];

// Monochrome glyphs, not emoji: the tile stays calm and consistent with the
// rest of the interface, and colour is reserved for meaning.
const glyphs = new Map<string, IconName>(Object.entries({
  comida: 'restaurant-outline', comidas: 'restaurant-outline', alimentacion: 'restaurant-outline', restaurante: 'restaurant-outline',
  restaurantes: 'restaurant-outline', delivery: 'bicycle-outline', 'fast food': 'fast-food-outline', pizza: 'pizza-outline',
  cafe: 'cafe-outline', cafeteria: 'cafe-outline', bebidas: 'wine-outline', bar: 'beer-outline',
  supermercado: 'cart-outline', supermercados: 'cart-outline', super: 'cart-outline', almacen: 'basket-outline', compras: 'bag-outline', shopping: 'bag-outline',
  transporte: 'bus-outline', combustible: 'car-outline', nafta: 'car-outline', auto: 'car-outline', taxi: 'car-outline', uber: 'car-outline',
  hogar: 'home-outline', alquiler: 'home-outline', vivienda: 'home-outline', expensas: 'business-outline', muebles: 'bed-outline',
  servicios: 'flash-outline', luz: 'flash-outline', gas: 'flame-outline', agua: 'water-outline', internet: 'wifi-outline', celular: 'phone-portrait-outline', telefono: 'phone-portrait-outline',
  salud: 'medkit-outline', farmacia: 'medkit-outline', medico: 'medkit-outline', ropa: 'shirt-outline', indumentaria: 'shirt-outline', belleza: 'cut-outline',
  ocio: 'ticket-outline', entretenimiento: 'ticket-outline', cine: 'film-outline', musica: 'musical-notes-outline', juegos: 'game-controller-outline',
  suscripciones: 'repeat-outline', suscripcion: 'repeat-outline', streaming: 'tv-outline', tecnologia: 'laptop-outline',
  educacion: 'school-outline', libros: 'book-outline', cursos: 'school-outline', viajes: 'airplane-outline', vacaciones: 'airplane-outline', hotel: 'bed-outline',
  mascotas: 'paw-outline', deporte: 'barbell-outline', deportes: 'barbell-outline', gimnasio: 'barbell-outline',
  impuestos: 'document-text-outline', seguros: 'shield-checkmark-outline', bancos: 'business-outline', comisiones: 'business-outline',
  regalos: 'gift-outline', regalo: 'gift-outline', hijos: 'people-outline', familia: 'people-outline',
  sueldo: 'briefcase-outline', salario: 'briefcase-outline', trabajo: 'laptop-outline', freelance: 'laptop-outline', honorarios: 'briefcase-outline',
  reembolsos: 'return-down-back-outline', reembolso: 'return-down-back-outline', prestamos: 'people-outline', prestamo: 'people-outline',
  inversiones: 'trending-up-outline', intereses: 'trending-up-outline', ventas: 'pricetags-outline', otros: 'ellipsis-horizontal',
}));

export function categoryIcon(label: string): IconName {
  return glyphs.get(categoryKey(label)) ?? 'pricetag-outline';
}

export function categoryChoices(entries: Entry[], kind: EntryKind, query = '', selected = ''): string[] {
  const choices = new Map<string, string>();
  // Existing spellings win. Selecting one must not rename previous categories.
  const add = (label: string) => { const key = categoryKey(label); if (key && !choices.has(key)) choices.set(key, label.trim()); };
  if (selected) add(selected);
  entries.filter(entry => entry.kind === kind).slice().sort((a, b) => b.dateISO.localeCompare(a.dateISO)).forEach(entry => add(entry.category));
  (kind === 'income' ? incomeLabels : expenseLabels).forEach(add);
  const terms = categoryKey(query).split(' ').filter(Boolean);
  return [...choices.values()].filter(label => terms.every(term => categoryKey(label).includes(term)));
}

export function customCategory(query: string, choices: string[]): string | null {
  const value = query.trim();
  if (!value || value.length > 60 || choices.some(label => categoryKey(label) === categoryKey(value))) return null;
  return value;
}

export interface CategoryCatalogRow { label: string; preset: boolean; count: number }

/** Read-only catalogue for Más → Categorías: the presets in their order, then
 * every category recorded on the given entries that is not a preset, most used
 * first. A recorded spelling wins over the preset's, as in the picker. Strings
 * are read as stored; nothing is renamed, merged, archived or deleted here.
 * Editing and archiving categories is its own later phase. */
export function categoryCatalog(entries: Entry[], kind: EntryKind): CategoryCatalogRow[] {
  const recorded = new Map<string, { label: string; count: number }>();
  for (const entry of entries) {
    if (entry.kind !== kind) continue;
    const key = categoryKey(entry.category);
    if (!key) continue;
    const row = recorded.get(key);
    if (row) row.count++; else recorded.set(key, { label: entry.category.trim(), count: 1 });
  }
  const presets = kind === 'income' ? incomeLabels : expenseLabels;
  const presetKeys = new Set(presets.map(categoryKey));
  const rows = presets.map(label => ({ label: recorded.get(categoryKey(label))?.label ?? label, preset: true, count: recorded.get(categoryKey(label))?.count ?? 0 }));
  const custom = [...recorded.entries()].filter(([key]) => !presetKeys.has(key)).map(([, row]) => ({ ...row, preset: false }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
  return [...rows, ...custom];
}
