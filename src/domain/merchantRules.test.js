import { describe, expect, it } from 'vitest';
import { applyMerchantSuggestion, resolveCategoryId, suggestMerchant } from './merchantRules.js';

const categories = {
  comida: { name: 'Comida', type: 'gasto' },
  auto: { name: 'Auto', type: 'gasto' },
  compras: { name: 'Compras', type: 'gasto' },
  inversion: { name: 'Inversión', type: 'inversion' },
  inversiones: { name: 'Inversiones', type: 'gasto' },
};

describe('merchant rules', () => {
  it('matches case-insensitively and accent-insensitively', () => {
    expect(suggestMerchant('CAFÉ MART')).toEqual({ key: 'cafe', category: 'comida', tags: ['cafe'] });
    expect(suggestMerchant('Uber Trip')).toEqual({ key: 'movilidad', category: 'transporte', tags: ['movilidad'] });
  });

  it('resolves known categories and current transporte alias safely', () => {
    expect(resolveCategoryId('Comida', categories)).toBe('comida');
    expect(resolveCategoryId('transporte', categories)).toBe('auto');
    expect(resolveCategoryId('inversiones', categories)).toBe('inversiones');
  });

  it('suggests category and tags without overwriting manual category', () => {
    expect(
      applyMerchantSuggestion({ merchant: 'Amazon', categories, currentCategory: 'comida', categoryTouched: false, currentTags: [] })
    ).toMatchObject({ key: 'amazon', category: 'compras', tags: ['online'] });

    expect(
      applyMerchantSuggestion({ merchant: 'Amazon', categories, currentCategory: 'comida', categoryTouched: true, currentTags: ['regalo'] })
    ).toMatchObject({ key: 'amazon', category: 'comida', tags: ['regalo', 'online'] });
  });
});
