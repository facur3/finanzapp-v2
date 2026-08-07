import { describe, expect, it } from 'vitest';
import { parseSetupImport } from './setupImport.js';

const valid = {
  app: 'FinanzApp', schema: 'finanzapp.setup.v1', version: 1,
  setup: {
    accounts: [{ id: 'demo-invest', name: 'Cuenta de prueba', kind: 'invest', currency: 'ARS', balance: 0 }],
    cards: [{ id: 'demo-card', brand: 'Tarjeta demo', bank: 'Banco ficticio', last4: '0000', saldo: 0, limit: 1, cierre: '1 ene', vence: '2 ene' }],
    assets: [{ accountId: 'demo-invest', id: 'demo-asset', ticker: 'TEST', name: 'Activo ficticio', qty: 1, avg: 1, lastPrice: 1 }],
    investmentLots: [{ importKey: 'demo-lot', accountId: 'demo-invest', ticker: 'TEST', qty: 1, total: 1, dateISO: '2026-01-01' }],
    recurring: [],
  },
};

describe('setup import schema', () => {
  it('normalizes a safe incremental setup', () => {
    const result = parseSetupImport(valid);
    expect(result.setup.cards[0]).toMatchObject({ last4: '0000', compras: [], cuotas: [], pagos: [] });
    expect(result.setup.assets[0]).toMatchObject({ ticker: 'TEST', qty: 1, costUnknown: false });
    expect(result.setup.assets[0]).toMatchObject({ quoteTicker: 'TEST', quoteCurrency: 'ARS', costCurrency: 'ARS', unitDivisor: 1 });
  });

  it('rejects an unsupported schema before it can touch app state', () => {
    expect(() => parseSetupImport({ ...valid, schema: 'unknown' })).toThrow('invalid-setup');
  });

  it('allows an explicitly unknown historical cost without inventing performance', () => {
    const payload = structuredClone(valid);
    payload.setup.assets[0] = { ...payload.setup.assets[0], avg: undefined, costUnknown: true };
    expect(parseSetupImport(payload).setup.assets[0]).toMatchObject({ costUnknown: true, avg: 1 });
  });

  it('preserves USD bond quote semantics and provenance', () => {
    const payload = structuredClone(valid);
    payload.setup.assets[0] = {
      ...payload.setup.assets[0],
      ticker: 'AO27D',
      quoteTicker: 'AO27D',
      quoteCurrency: 'USD',
      costCurrency: 'USD',
      unitDivisor: 100,
      arsQuoteTicker: 'AO27',
      lastPriceARS: 156160,
      quoteSource: 'Broker statement',
    };
    payload.setup.investmentLots[0] = { ...payload.setup.investmentLots[0], ticker: 'AO27D', currency: 'USD', unitDivisor: 100 };
    expect(parseSetupImport(payload).setup.assets[0]).toMatchObject({ quoteCurrency: 'USD', costCurrency: 'USD', unitDivisor: 100, arsQuoteTicker: 'AO27', lastPriceARS: 156160 });
    expect(parseSetupImport(payload).setup.investmentLots[0]).toMatchObject({ currency: 'USD', unitDivisor: 100 });
  });
});
