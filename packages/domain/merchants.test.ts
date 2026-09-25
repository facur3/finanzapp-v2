import { describe, expect, it } from 'vitest';
import { AMBIGUOUS_MERCHANT_WORDS, MERCHANT_CATALOG, merchantIndex, merchantKey, resolveMerchant, validateMerchantCatalog,
  type MerchantBrand } from './merchants';

const idOf = (name: string) => { const found = resolveMerchant(name); return found.status === 'recognized' ? found.brand.id : null; };

describe('merchant names are normalized, never rewritten', () => {
  it('folds case, accents, punctuation and spacing into one key', () => {
    expect(merchantKey('  NETFLIX  ')).toBe('netflix');
    expect(merchantKey('Netflix.com')).toBe('netflix com');
    expect(merchantKey('Disney+')).toBe('disney plus');
    expect(merchantKey('Disney Plus')).toBe('disney plus');
    expect(merchantKey("McDonald's")).toBe('mcdonalds');
    expect(merchantKey('McDonald’s')).toBe('mcdonalds');
    expect(merchantKey('Farmacía   Centrál')).toBe('farmacia central');
    expect(merchantKey('Ｎｅｔｆｌｉｘ')).toBe('netflix');
    expect(merchantKey('')).toBe('');
    expect(merchantKey('—')).toBe('');
  });

  it('keeps the typed name: resolution returns a key and a brand, never a replacement text', () => {
    const typed = 'netflix familia';
    const result = resolveMerchant(typed);
    expect(result.status).toBe('unrecognized');
    expect(result.key).toBe('netflix familia');
    expect(typed).toBe('netflix familia');
  });
});

describe('recognition is an exact alias lookup', () => {
  it('recognizes the curated spellings of a brand', () => {
    expect(idOf('Netflix')).toBe('netflix');
    expect(idOf('netflix.com')).toBe('netflix');
    expect(idOf('Spotify Premium')).toBe('spotify');
    expect(idOf('Disney+')).toBe('disney-plus');
    expect(idOf('MercadoLibre')).toBe('mercado-libre');
    expect(idOf('Mercado Pago')).toBe('mercado-pago');
    expect(idOf("McDonald's")).toBe('mcdonalds');
    expect(idOf('YPF')).toBe('ypf');
    // 24UX2 review: brands whose bare name is a common word stay reachable through qualified aliases.
    expect(idOf('apple.com')).toBe('apple');
    expect(idOf('Apple Music')).toBe('apple');
    expect(idOf('App Store')).toBe('apple');
    expect(idOf('iCloud')).toBe('apple');
    expect(idOf('Steam games')).toBe('steam');
    expect(idOf('steampowered.com')).toBe('steam');
    expect(idOf('Adobe Creative Cloud')).toBe('adobe');
    expect(idOf('adobe.com')).toBe('adobe');
    expect(idOf('Despegar.com')).toBe('despegar');
  });

  it('never matches a brand inside a longer or different name', () => {
    for (const name of ['Netflix y Spotify', 'Pago Netflix', 'Netflixx', 'Netfl1x', 'Spotify familiar compartido', 'Uber a Palermo',
      'Almacén Apple', 'Supermercado Carrefour Express']) {
      expect(resolveMerchant(name).status, name).toBe('unrecognized');
    }
  });

  it('keeps sibling brands apart', () => {
    expect(idOf('Uber')).toBe('uber');
    expect(idOf('Uber Eats')).toBe('uber-eats');
    expect(idOf('Mercado Libre')).not.toBe(idOf('Mercado Pago'));
  });

  it('leaves ordinary words and ambiguous names unrecognized', () => {
    for (const name of ['Personal', 'Claro', 'Día', 'Coto', 'Max', 'Shell', 'Amazon', 'Google', 'Prime', 'Premium', 'Plus',
      'Apple', 'APPLE', ' apple ', 'Apples', 'Steam', 'Adobe', 'Despegar']) {
      expect(resolveMerchant(name).status, name).toBe('unrecognized');
    }
  });

  it('treats an empty or blank name as unrecognized', () => {
    expect(resolveMerchant('')).toEqual({ status: 'unrecognized', key: '' });
    expect(resolveMerchant('   ').status).toBe('unrecognized');
  });
});

describe('the catalogue is checked', () => {
  it('passes its own validation and exposes every alias', () => {
    expect(() => validateMerchantCatalog(MERCHANT_CATALOG)).not.toThrow();
    const index = merchantIndex();
    expect(index.size).toBe(MERCHANT_CATALOG.reduce((sum, item) => sum + item.aliases.length, 0));
    for (const item of MERCHANT_CATALOG) expect(item.aliases.every(alias => !AMBIGUOUS_MERCHANT_WORDS.includes(alias))).toBe(true);
  });

  it('carries identity only: no category, no network address beyond the lookup domain', () => {
    for (const item of MERCHANT_CATALOG) {
      expect(Object.keys(item).sort()).toEqual(['aliases', 'domain', 'id', 'name']);
      expect(item.domain).not.toMatch(/^https?:|\//);
    }
  });

  const base: MerchantBrand = { id: 'a', name: 'A', domain: 'a.com', aliases: ['a brand'] };
  it('refuses an alias shared by two brands', () => {
    expect(() => validateMerchantCatalog([base, { ...base, id: 'b', name: 'B', domain: 'b.com' }])).toThrow(/names both a and b/);
  });
  it('refuses an alias that is not normalized', () => {
    expect(() => validateMerchantCatalog([{ ...base, aliases: ['A Brand'] }])).toThrow(/not normalized/);
  });
  it('refuses an ambiguous alias', () => {
    expect(() => validateMerchantCatalog([{ ...base, aliases: ['personal'] }])).toThrow(/Ambiguous/);
  });
  it('refuses repeated ids, bad ids and bad domains', () => {
    expect(() => validateMerchantCatalog([base, { ...base, aliases: ['other'] }])).toThrow(/Repeated/);
    expect(() => validateMerchantCatalog([{ ...base, id: 'Bad Id' }])).toThrow(/Invalid merchant id/);
    expect(() => validateMerchantCatalog([{ ...base, domain: 'https://a.com' }])).toThrow(/Invalid merchant domain/);
  });
  it('resolves against a custom catalogue without touching the default one', () => {
    const index = merchantIndex([base]);
    expect(resolveMerchant('A-Brand', index).status).toBe('recognized');
    expect(resolveMerchant('A-Brand').status).toBe('unrecognized');
  });
});
