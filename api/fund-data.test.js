import { describe, expect, it, vi } from 'vitest';
import handler, { calculateFundReturns, getOfficialFundData, parseCafciFundPage } from './fund-data.js';

const PAGE = `
  <a href="/v2/fondos/876/ficha-regulatoria.pdf?clase=2516&amp;fecha=2026-07-31">PDF</a>
  <td>Valor Cuotaparte</td><td class="value">11.465,424</td>
  <canvas data-vcp-chart-data-value="[{&quot;fecha&quot;:&quot;2026-07-24&quot;,&quot;valor&quot;:&quot;11423.10&quot;},{&quot;fecha&quot;:&quot;2026-07-31&quot;,&quot;valor&quot;:&quot;11465.424&quot;}]"></canvas>
`;

const response = () => {
  const result = { statusCode: 0, body: null, headers: {} };
  result.setHeader = (key, value) => { result.headers[key] = value; };
  result.status = code => { result.statusCode = code; return result; };
  result.json = body => { result.body = body; return result; };
  return result;
};

describe('official CAFCI fund data', () => {
  it('parses the localized VCP, date and history from the official page', () => {
    expect(parseCafciFundPage(PAGE)).toEqual({
      price: 11465.424,
      asOf: '2026-07-31',
      history: [
        { date: '2026-07-24', price: 11423.1 },
        { date: '2026-07-31', price: 11465.424 },
      ],
    });
  });

  it('uses a fixed allowlist instead of accepting arbitrary URLs', async () => {
    await expect(getOfficialFundData('otro-fondo', vi.fn())).rejects.toThrow('unsupported fund');
  });

  it('calculates actual period returns from the official VCP series', () => {
    const returns = calculateFundReturns([
      { date: '2025-12-30', price: 100 },
      { date: '2026-07-01', price: 110 },
      { date: '2026-07-24', price: 120 },
      { date: '2026-07-31', price: 123 },
    ]);
    expect(returns.sevenDays).toMatchObject({ from: '2026-07-24', to: '2026-07-31' });
    expect(returns.sevenDays.percent).toBeCloseTo(0.025, 12);
    expect(returns.thirtyDays).toEqual({ percent: 123 / 110 - 1, from: '2026-07-01', to: '2026-07-31' });
    expect(returns.yearToDate).toMatchObject({ from: '2025-12-30', to: '2026-07-31' });
    expect(returns.yearToDate.percent).toBeCloseTo(0.23, 12);
  });

  it('returns normalized official data from the server route', async () => {
    const oldFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => PAGE });
    const res = response();
    await handler({ query: { fund: 'cocos-rendimiento-clase-a' } }, res);
    global.fetch = oldFetch;
    expect(res.statusCode).toBe(200);
    expect(res.body.price).toBe(11465.424);
    expect(res.body.source).toBe('CAFCI oficial');
    expect(res.body.returns.sevenDays).toBeTruthy();
  });
});
