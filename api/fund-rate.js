const ALLOWED = new Set(['cocos-daruma-renta-mixta']);

export function parseEstimatedAnnualRate(html) {
  const text = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ');
  const match = text.match(/rendimiento anual estimado\s*([0-9]+(?:[.,][0-9]+)?)\s*%/i);
  return match ? Number(match[1].replace(',', '.')) : 0;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600');
  try {
    const slug = String((req.query || {}).slug || '');
    if (!ALLOWED.has(slug)) return res.status(400).json({ error: 'unsupported fund' });
    const response = await fetch('https://cocos.capital/fondos/' + slug, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) throw new Error('Cocos ' + response.status);
    const rate = parseEstimatedAnnualRate(await response.text());
    if (!(rate > 0)) throw new Error('rate not found');
    res.status(200).json({ rate, source: 'Cocos Capital', fetchedAt: new Date().toISOString(), estimated: true });
  } catch (error) {
    res.status(503).json({ error: String(error && error.message || error) });
  }
}
