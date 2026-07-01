// Vercel serverless function: proxies Yahoo Finance chart data server-side so the
// browser never hits CORS. Called as /api/chart?ticker=QQQ.BA&range=1mo&interval=1d
export default async function handler(req, res) {
  try {
    const { ticker = '', range = '1mo', interval = '1d' } = req.query || {};
    const t = String(ticker).replace(/[^A-Za-z0-9.\-^=]/g, '');
    if (!t) { res.status(400).json({ error: 'missing ticker' }); return; }
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(t) +
      '?range=' + encodeURIComponent(range) + '&interval=' + encodeURIComponent(interval);
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const j = await r.json();
    const result = j && j.chart && j.chart.result && j.chart.result[0];
    const rawCloses = (result && result.indicators && result.indicators.quote &&
      result.indicators.quote[0] && result.indicators.quote[0].close) || [];
    const rawTimes = (result && result.timestamp) || [];
    // Keep timestamp+close pairs aligned by dropping the null closes together.
    const closes = [], times = [];
    for (let i = 0; i < rawCloses.length; i++) {
      if (rawCloses[i] != null) { closes.push(rawCloses[i]); times.push(rawTimes[i] || null); }
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ closes, times });
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ closes: [], times: [], error: String(e && e.message || e) });
  }
}
