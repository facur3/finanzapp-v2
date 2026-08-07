const FUNDS = {
  'cocos-rendimiento-clase-a': {
    fundId: '876',
    classId: '2516',
    name: 'Cocos Rendimiento - Clase A',
  },
};

const decodeEntities = value => String(value || '')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const localeNumber = value => {
  const normalized = String(value || '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
};

export function parseCafciFundPage(html) {
  const source = String(html || '');
  const priceMatch = source.match(/Valor Cuotaparte<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
  const price = localeNumber((priceMatch && priceMatch[1] || '').replace(/<[^>]+>/g, ''));
  const dateMatch = source.match(/ficha-regulatoria\.pdf\?[^"']*?fecha=(\d{4}-\d{2}-\d{2})/i);
  const chartMatch = source.match(/data-vcp-chart-data-value="([^"]+)"/i);
  let history = [];
  if (chartMatch) {
    try {
      const rows = JSON.parse(decodeEntities(chartMatch[1]));
      history = (Array.isArray(rows) ? rows : [])
        .map(row => ({ date: String(row.fecha || ''), price: Number(row.valor) }))
        .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.price) && row.price > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      history = [];
    }
  }
  const asOf = (dateMatch && dateMatch[1]) || (history.length ? history[history.length - 1].date : null);
  return { price, asOf, history };
}

export async function getOfficialFundData(slug, fetchImpl = fetch) {
  const fund = FUNDS[String(slug || '')];
  if (!fund) throw new Error('unsupported fund');
  const officialUrl = 'https://estadisticas.cafci2.org.ar/v2/fondos/' + fund.fundId + '/ficha-regulatoria?clase=' + fund.classId;
  const response = await fetchImpl(officialUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) throw new Error('CAFCI ' + response.status);
  const parsed = parseCafciFundPage(await response.text());
  if (!(parsed.price > 0) || !parsed.asOf) throw new Error('CAFCI data not found');
  return {
    ...parsed,
    name: fund.name,
    currency: 'ARS',
    source: 'CAFCI oficial',
    quality: 'official',
    officialUrl,
    fetchedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600');
  try {
    const data = await getOfficialFundData((req.query || {}).fund);
    res.status(200).json(data);
  } catch (error) {
    const status = String(error && error.message || error) === 'unsupported fund' ? 400 : 503;
    res.status(status).json({ error: String(error && error.message || error) });
  }
}
