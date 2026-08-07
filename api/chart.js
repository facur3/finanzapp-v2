import { getOfficialFundData } from './fund-data.js';

// Server-side historical chart adapter. The browser requests one normalized
// shape while the server chooses the correct public source for each asset.
const RANGE_DAYS = { '1d': 1, '5d': 5, '1mo': 30, max: 'max' };

const send = (res, payload) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json(payload);
};

const safe = (value, pattern) => {
  const normalized = String(value || '');
  return pattern.test(normalized) ? normalized : '';
};

const cutoffFor = range => {
  const days = RANGE_DAYS[range];
  if (!days || days === 'max') return 0;
  return Date.now() - days * 86400000;
};

export default async function handler(req, res) {
  try {
    const query = req.query || {};
    const provider = safe(query.provider || 'yahoo', /^[a-z-]+$/) || 'yahoo';
    const range = safe(query.range || '1mo', /^(1d|5d|1mo|max)$/) || '1mo';

    if (provider === 'fci') {
      const fund = safe(query.fund, /^[a-z0-9-]+$/);
      if (!fund) return send(res, { closes: [], times: [], currency: 'ARS', error: 'missing fund' });
      let points = [];
      let source = 'CAFCI oficial';
      try {
        const data = await getOfficialFundData(fund);
        points = data.history.map(row => ({ time: Date.parse(row.date), close: Number(row.price) }));
      } catch (officialError) {
        const response = await fetch('https://api.argentinadatos.com/v1/finanzas/fci/fondos/' + encodeURIComponent(fund) + '/historico');
        if (!response.ok) throw new Error('FCI provider ' + response.status);
        const data = await response.json();
        points = (Array.isArray(data && data.historico) ? data.historico : [])
          .map(row => ({ time: Date.parse(row.fecha), close: Number(row.valorCuotaparte) }));
        source = 'CAFCI vía ArgentinaDatos';
      }
      const cutoff = cutoffFor(range);
      points = points
        .filter(point => Number.isFinite(point.time) && point.close > 0 && (!cutoff || point.time >= cutoff))
        .sort((a, b) => a.time - b.time);
      return send(res, { closes: points.map(point => point.close), times: points.map(point => Math.round(point.time / 1000)), currency: 'ARS', source });
    }

    if (provider === 'coingecko') {
      const coin = safe(query.coin, /^[a-z0-9-]+$/);
      if (!coin) return send(res, { closes: [], times: [], currency: 'USD', error: 'missing coin' });
      const days = RANGE_DAYS[range] || 30;
      const response = await fetch('https://api.coingecko.com/api/v3/coins/' + encodeURIComponent(coin) + '/market_chart?vs_currency=usd&days=' + days);
      if (!response.ok) throw new Error('CoinGecko provider ' + response.status);
      const data = await response.json();
      const points = (Array.isArray(data && data.prices) ? data.prices : [])
        .map(row => ({ time: Number(row[0]), close: Number(row[1]) }))
        .filter(point => Number.isFinite(point.time) && point.close > 0);
      return send(res, { closes: points.map(point => point.close), times: points.map(point => Math.round(point.time / 1000)), currency: 'USD', source: 'CoinGecko' });
    }

    const ticker = safe(query.ticker, /^[A-Za-z0-9.\-^=]+$/);
    const interval = safe(query.interval || '1d', /^(15m|60m|1d|1wk)$/) || '1d';
    if (!ticker) return send(res, { closes: [], times: [], currency: 'ARS', error: 'missing ticker' });
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) +
      '?range=' + encodeURIComponent(range) + '&interval=' + encodeURIComponent(interval);
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) throw new Error('Yahoo provider ' + response.status);
    const data = await response.json();
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    const rawCloses = (result && result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || [];
    const rawTimes = (result && result.timestamp) || [];
    const closes = [], times = [];
    for (let index = 0; index < rawCloses.length; index++) {
      if (rawCloses[index] != null) {
        closes.push(rawCloses[index]);
        times.push(rawTimes[index] || null);
      }
    }
    return send(res, { closes, times, currency: (result && result.meta && result.meta.currency) || 'ARS', source: 'Yahoo Finance' });
  } catch (error) {
    send(res, { closes: [], times: [], error: String(error && error.message || error) });
  }
}
