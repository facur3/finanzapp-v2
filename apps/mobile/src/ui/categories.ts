import { categoryKey, type Entry, type EntryKind } from '@finanzapp/domain';
export { categoryKey } from '@finanzapp/domain';

// Interface choices, not seeded transactions or an automatic reclassification.
// Keep the user's category string in the ledger, including custom categories.
const expenseLabels = ['Comida', 'Supermercado', 'Transporte', 'Hogar', 'Servicios', 'Salud', 'Ropa', 'Ocio', 'Educación', 'Viajes', 'Mascotas', 'Otros'];
const incomeLabels = ['Sueldo', 'Trabajo', 'Regalos', 'Reembolsos', 'Préstamos', 'Otros'];

const symbols = new Map<string, string>(Object.entries({
  comida: '🍽️', comidas: '🍽️', alimentacion: '🍽️', restaurante: '🍽️', restaurantes: '🍽️', delivery: '🍽️',
  cafe: '☕', cafeteria: '☕', supermercado: '🛒', supermercados: '🛒', compras: '🛍️',
  transporte: '🚗', combustible: '⛽', hogar: '🏠', alquiler: '🏠', vivienda: '🏠',
  servicios: '💡', salud: '💊', farmacia: '💊', ropa: '👕', indumentaria: '👕',
  ocio: '🎟️', entretenimiento: '🎟️', educacion: '📚', viajes: '✈️', mascotas: '🐾',
  deporte: '🏃', gimnasio: '🏃', sueldo: '💼', salario: '💼', trabajo: '💻',
  regalos: '🎁', regalo: '🎁', reembolsos: '↩️', reembolso: '↩️', prestamos: '🤝', prestamo: '🤝',
}));

export function categorySymbol(label: string): string {
  return symbols.get(categoryKey(label)) ?? '🧾';
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
