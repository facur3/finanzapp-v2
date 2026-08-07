import { describe, expect, it } from 'vitest';
import {
  applyAssetQuote,
  assetCostARS,
  assetPerformanceValueARS,
  assetValueARS,
  fciPeriodChange,
  investmentValuation,
  matchFundRecord,
  quoteFreshness,
} from './investments.js';

describe('investment valuation', () => {
  it('values an ARS CEDEAR per certificate', () => {
    expect(assetValueARS({ qty: 18, lastPrice: 57025, quoteCurrency: 'ARS' }, 1500)).toBe(1026450);
  });

  it('values a USD bond quoted per 100 nominal units', () => {
    const ao27d = { qty: 197, lastPrice: 102.4, avg: 102.822335, quoteCurrency: 'USD', costCurrency: 'USD', unitDivisor: 100 };
    expect(assetValueARS(ao27d, 1500)).toBeCloseTo(302592, 6);
    expect(assetCostARS(ao27d, 1500)).toBeCloseTo(303840, 3);
  });

  it('prefers the directly traded ARS species for a USD bond portfolio value', () => {
    const ao27d = { qty: 197, lastPrice: 101.85, lastPriceARS: 156160, quoteCurrency: 'USD', unitDivisor: 100 };
    expect(assetValueARS(ao27d, 0)).toBeCloseTo(307635.2, 6);
    expect(investmentValuation([ao27d], 0)).toEqual({ valueARS: 307635.2, complete: true });
    expect(assetPerformanceValueARS(ao27d, 1500)).toBeCloseTo(300966.75, 6);
  });

  it('reports an incomplete valuation instead of treating USD as pesos without a rate', () => {
    expect(investmentValuation([{ qty: 1, lastPrice: 100, quoteCurrency: 'USD' }], 0)).toEqual({ valueARS: 100, complete: false });
  });
});

describe('FCI market data', () => {
  const funds = [
    { fondo: 'Cocos Rendimiento - Clase B', vcp: 11519.688 },
    { fondo: 'Cocos Rendimiento - Clase A', vcp: 11503.24 },
  ];

  it('matches the requested class instead of the first similar fund', () => {
    expect(matchFundRecord(funds, ['Cocos Rendimiento - Clase A']).vcp).toBe(11503.24);
  });

  it('calculates the real period return from two VCP values', () => {
    expect(fciPeriodChange({ vcp: 11503.24 }, { vcp: 11496.91 }, 18.862)).toEqual({
      amount: 18.862 * (11503.24 - 11496.91),
      percent: (11503.24 - 11496.91) / 11496.91,
    });
  });
});

describe('quote provenance', () => {
  it('keeps the old asset untouched when a provider returns no valid price', () => {
    const asset = { ticker: 'QQQ', lastPrice: 10 };
    expect(applyAssetQuote(asset, { price: 0 })).toBe(asset);
  });

  it('stores source, currency and timestamps with a valid quote', () => {
    const result = applyAssetQuote({ ticker: 'BTC' }, {
      price: 65000,
      currency: 'USD',
      source: 'Binance',
      quality: 'current',
      asOf: '2026-08-07T20:00:00.000Z',
      fetchedAt: '2026-08-07T20:00:01.000Z',
    });
    expect(result).toMatchObject({ lastPrice: 65000, quoteCurrency: 'USD', quoteSource: 'Binance', quoteQuality: 'current' });
    expect(quoteFreshness(result, Date.parse('2026-08-07T21:00:00.000Z'))).toBe('current');
  });

  it('does not replace a newer broker capture with an older provider observation', () => {
    const asset = {
      lastPrice: 11503.24,
      quoteSource: 'Cocos · captura',
      quoteAsOf: '2026-08-07T17:44:00-03:00',
    };
    const result = applyAssetQuote(asset, {
      price: 11465.424,
      source: 'CAFCI oficial',
      asOf: '2026-07-31',
      fetchedAt: '2026-08-07T21:00:00Z',
    });
    expect(result).toBe(asset);
  });
});
