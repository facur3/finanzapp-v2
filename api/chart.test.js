import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from './chart.js';

const response = () => {
  const result = { headers: {}, code: 0, body: null };
  return {
    result,
    setHeader(key, value) { result.headers[key] = value; },
    status(code) { result.code = code; return this; },
    json(body) { result.body = body; return this; },
  };
};

afterEach(() => vi.unstubAllGlobals());

describe('chart provider adapter', () => {
  it('normalizes an FCI VCP history in ARS', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => `
        <a href="ficha-regulatoria.pdf?clase=2516&amp;fecha=2026-08-07">PDF</a>
        <td>Valor Cuotaparte</td><td>11.503,24</td>
        <canvas data-vcp-chart-data-value="[{&quot;fecha&quot;:&quot;2026-08-06&quot;,&quot;valor&quot;:&quot;11496.91&quot;},{&quot;fecha&quot;:&quot;2026-08-07&quot;,&quot;valor&quot;:&quot;11503.24&quot;}]"></canvas>
      `,
    })));
    const res = response();
    await handler({ query: { provider: 'fci', fund: 'cocos-rendimiento-clase-a', range: 'max' } }, res);
    expect(res.result.body).toMatchObject({ closes: [11496.91, 11503.24], currency: 'ARS', source: 'CAFCI oficial' });
  });

  it('normalizes CoinGecko millisecond timestamps to seconds', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ prices: [[1000, 10], [2000, 11]] }) })));
    const res = response();
    await handler({ query: { provider: 'coingecko', coin: 'bitcoin', range: '1d' } }, res);
    expect(res.result.body).toMatchObject({ closes: [10, 11], times: [1, 2], currency: 'USD' });
  });

  it('returns an empty safe result when a provider fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    const res = response();
    await handler({ query: { provider: 'fci', fund: 'cocos-rendimiento-clase-a', range: 'max' } }, res);
    expect(res.result.code).toBe(200);
    expect(res.result.body.closes).toEqual([]);
  });
});
