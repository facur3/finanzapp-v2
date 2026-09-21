import { describe, expect, it } from 'vitest';
import { ACCOUNT_ICONS, APPEARANCE_COLORS, CATEGORY_ICONS, accountLook, appearanceColor, isAccountIconId, isAppearanceColorId, isCategoryIconId,
  makeAccountAppearance, sameAccountAppearance, validateAccountAppearance, validateAccountAppearances, type AccountAppearance } from './appearance';
import type { Account } from './ledger';

const account: Account = { id: 'a', name: 'Cocos', currency: 'ARS', openingMinor: 100000, createdAt: '2026-09-21T12:00:00Z' };
const now = '2026-09-21T13:00:00Z';

function luminance(hex: string): number {
  const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(parseInt(hex.slice(1, 3), 16)) + 0.7152 * channel(parseInt(hex.slice(3, 5), 16)) + 0.0722 * channel(parseInt(hex.slice(5, 7), 16));
}
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('appearance catalogue', () => {
  it('is a small curated palette with accessible names and unique ids', () => {
    expect(APPEARANCE_COLORS.length).toBeGreaterThanOrEqual(8);
    expect(APPEARANCE_COLORS.length).toBeLessThanOrEqual(12);
    expect(new Set(APPEARANCE_COLORS.map(color => color.id)).size).toBe(APPEARANCE_COLORS.length);
    for (const color of APPEARANCE_COLORS) {
      expect(color.name).not.toMatch(/círculo|circle/i);
      expect(color.light).toMatch(/^#[0-9A-F]{6}$/);
      expect(color.dark).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
  it('keeps every colour readable as a glyph on the light and dark surfaces', () => {
    for (const color of APPEARANCE_COLORS) {
      expect(contrast(color.light, '#FFFFFF'), `${color.id} light on white`).toBeGreaterThanOrEqual(3);
      expect(contrast(color.dark, '#1C1C1E'), `${color.id} dark on dark surface`).toBeGreaterThanOrEqual(3);
    }
  });
  it('excludes the expense coral: identity never borrows a semantic colour', () => {
    expect(APPEARANCE_COLORS.some(color => color.light === '#C42F39' || color.dark === '#F0555C')).toBe(false);
  });
  it('curates icons without emoji and with unique ids', () => {
    for (const set of [ACCOUNT_ICONS, CATEGORY_ICONS]) {
      expect(new Set(set.map(icon => icon.id)).size).toBe(set.length);
      for (const icon of set) expect(icon.name).toMatch(/^[A-Za-zÁÉÍÓÚáéíóúñÑ ]+$/);
    }
    expect(ACCOUNT_ICONS.map(icon => icon.id)).toEqual(expect.arrayContaining(['wallet', 'cash', 'bank', 'savings', 'business', 'investment', 'safe']));
    expect(CATEGORY_ICONS.length).toBeGreaterThan(30);
    expect(CATEGORY_ICONS.length).toBeLessThan(60);
  });
  it('rejects unknown ids', () => {
    expect(isAppearanceColorId('cobalt')).toBe(true);
    expect(isAppearanceColorId('#2557D6')).toBe(false);
    expect(isAccountIconId('wallet')).toBe(true);
    expect(isAccountIconId('wallet-outline')).toBe(false);
    expect(isCategoryIconId('food')).toBe(true);
    expect(isCategoryIconId('🍕')).toBe(false);
    expect(appearanceColor('nope').id).toBe('cobalt');
  });
});

describe('account appearance', () => {
  const look = makeAccountAppearance(account.id, 'bank', 'azure', now);
  it('defaults to wallet on cobalt without writing anything', () => {
    expect(accountLook('a')).toEqual({ icon: 'wallet', color: 'cobalt' });
    expect(accountLook('a', [look])).toEqual({ icon: 'bank', color: 'azure' });
  });
  it('validates ids, versions and the account it belongs to', () => {
    expect(() => validateAccountAppearance(look, [account])).not.toThrow();
    expect(() => validateAccountAppearance(look, [])).toThrow(/cuenta existente/);
    expect(() => validateAccountAppearance({ ...look, icon: 'rocket' as never }, [account])).toThrow(/ícono/);
    expect(() => validateAccountAppearance({ ...look, color: '#FF0000' as never }, [account])).toThrow(/color/);
    expect(() => validateAccountAppearance({ ...look, updatedAt: '2026-09-22T00:00:00Z' }, [account])).toThrow(/inicial/);
    expect(() => validateAccountAppearance({ ...look, revision: -1 }, [account])).toThrow();
    expect(() => validateAccountAppearances([look, look], [account])).toThrow(/repite/);
  });
  it('edits as a new revision that leaves the account untouched', () => {
    const next = makeAccountAppearance(account.id, 'cash', 'green', '2026-09-22T00:00:00Z', look);
    expect(next).toEqual({ ...look, icon: 'cash', color: 'green', revision: 1, updatedAt: '2026-09-22T00:00:00Z' });
    expect(sameAccountAppearance(look, next)).toBe(false);
    expect(sameAccountAppearance(look, { ...look })).toBe(true);
    expect(account).toEqual({ id: 'a', name: 'Cocos', currency: 'ARS', openingMinor: 100000, createdAt: '2026-09-21T12:00:00Z' });
  });
  it('keeps the record shape closed so a backup cannot smuggle balances', () => {
    const shape: AccountAppearance = look;
    expect(Object.keys(shape).sort()).toEqual(['accountId', 'color', 'createdAt', 'icon', 'revision', 'updatedAt']);
  });
});
