import { categoryKey, type Entry } from '@finanzapp/domain';
import type { Palette } from './theme';

/** Eight muted hues that read as one family on the neutral base. A category
 * keeps its hue across Home, Reportes and the drill-downs, so a colour is an
 * identity cue next to the name, never the only cue. Light and dark variants
 * keep similar lightness against their backgrounds. */
const HUES = [
  { light: '#C0654A', dark: '#E08A6E' }, // terracotta
  { light: '#3E6FB0', dark: '#6E9BE0' }, // steel blue
  { light: '#6F8A3A', dark: '#9DB85C' }, // olive
  { light: '#B0507A', dark: '#E07EA6' }, // rose
  { light: '#2E8A86', dark: '#4FB8B2' }, // teal
  { light: '#B8862B', dark: '#E0B24E' }, // ochre
  { light: '#6C5BB0', dark: '#9A8CE0' }, // indigo
  { light: '#5B6B7C', dark: '#93A3B4' }, // slate
] as const;

export const CATEGORY_HUES = HUES.length;

function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index++) value = (value * 31 + text.charCodeAt(index)) >>> 0;
  return value;
}

/** Hue index per category key. Each key starts at its hash; categories that
 * collide take the next free hue in order of first use, so an old category
 * never changes colour because a new one appeared. Beyond eight categories
 * hues repeat, which only affects the long tail grouped as Otras. */
export function assignCategoryHues(entries: Entry[]): Map<string, number> {
  const firstUse = new Map<string, string>();
  for (const entry of entries) {
    if (entry.kind !== 'expense') continue;
    const key = categoryKey(entry.category);
    if (!key) continue;
    const stamp = entry.dateISO + '|' + entry.createdAt;
    const previous = firstUse.get(key);
    if (previous === undefined || stamp < previous) firstUse.set(key, stamp);
  }
  const ordered = [...firstUse.entries()].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0])).map(([key]) => key);
  const taken = new Set<number>();
  const hues = new Map<string, number>();
  for (const key of ordered) {
    let hue = hash(key) % HUES.length;
    if (taken.size < HUES.length) while (taken.has(hue)) hue = (hue + 1) % HUES.length;
    taken.add(hue);
    hues.set(key, hue);
  }
  return hues;
}

export function hueColor(hue: number, p: Pick<Palette, 'isDark'>): string {
  const entry = HUES[((hue % HUES.length) + HUES.length) % HUES.length];
  return p.isDark ? entry.dark : entry.light;
}

/** Colour for a category label or key; unknown keys (a category with no
 * recorded expense yet) fall back to their hash so the answer is still stable. */
export function categoryColor(label: string, hues: Map<string, number>, p: Pick<Palette, 'isDark'>): string {
  const key = categoryKey(label);
  return hueColor(hues.get(key) ?? hash(key) % HUES.length, p);
}

/** A soft surface in the hue: the tile background behind a glyph. Hex alpha
 * keeps it one colour object rather than a second palette entry per hue. */
export function tintOf(color: string, p: Pick<Palette, 'isDark'>): string {
  return color + (p.isDark ? '33' : '24');
}

/** A wash of the hue behind a whole row (about 11 % dark, 8 % light): enough
 * to read a proportion against the surface, faint enough that the ink on it
 * keeps its contrast and three rows do not become a block of colour. */
export function washOf(color: string, p: Pick<Palette, 'isDark'>): string {
  return color + (p.isDark ? '1C' : '14');
}

/** The grouped tail ("Otras") is not a category: it stays neutral. */
export function othersColor(p: Pick<Palette, 'isDark'>): string {
  return p.isDark ? '#5C5C64' : '#C2C2CA';
}
