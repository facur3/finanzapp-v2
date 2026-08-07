import { convertCurrency, normalizeCurrency } from './currency.js';

const finite = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export function assetUnitDivisor(asset) {
  const divisor = finite(asset && asset.unitDivisor);
  return divisor > 0 ? divisor : 1;
}

export function assetQuoteCurrency(asset) {
  return normalizeCurrency(asset && asset.quoteCurrency);
}

export function assetCostCurrency(asset) {
  return normalizeCurrency((asset && asset.costCurrency) || assetQuoteCurrency(asset));
}

export function assetUnitValueARS(asset, usdRate) {
  const directARS = finite(asset && asset.lastPriceARS);
  if (directARS > 0) return directARS / assetUnitDivisor(asset);
  const price = finite(asset && (asset.lastPrice || asset.avg));
  if (price <= 0) return 0;
  return convertCurrency(price / assetUnitDivisor(asset), assetQuoteCurrency(asset), 'ARS', usdRate);
}

export function assetValueARS(asset, usdRate) {
  return finite(asset && asset.qty) * assetUnitValueARS(asset, usdRate);
}

// Performance must compare like with like. A USD bond may also have an ARS
// species for portfolio valuation, but its gain/loss is based on the USD quote
// against the USD purchase price, converted only after that comparison.
export function assetPerformanceValueARS(asset, usdRate) {
  const price = finite(asset && (asset.lastPrice || asset.avg));
  if (price <= 0) return 0;
  const nativeValue = finite(asset && asset.qty) * price / assetUnitDivisor(asset);
  return convertCurrency(nativeValue, assetQuoteCurrency(asset), 'ARS', usdRate);
}

export function assetUnitCostARS(asset, usdRate) {
  const average = finite(asset && asset.avg);
  if (average <= 0) return 0;
  return convertCurrency(average / assetUnitDivisor(asset), assetCostCurrency(asset), 'ARS', usdRate);
}

export function assetCostARS(asset, usdRate) {
  return finite(asset && asset.qty) * assetUnitCostARS(asset, usdRate);
}

export function investmentValuation(assets, usdRate) {
  const list = Array.isArray(assets) ? assets : [];
  let valueARS = 0;
  let complete = true;
  for (const asset of list) {
    if (assetQuoteCurrency(asset) === 'USD' && finite(asset && asset.lastPriceARS) <= 0 && finite(usdRate) <= 0) complete = false;
    const value = assetValueARS(asset, usdRate);
    if (value <= 0) complete = false;
    valueARS += value;
  }
  return { valueARS: Math.round(valueARS * 100) / 100, complete };
}

const normalizeWords = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function matchFundRecord(records, phrases) {
  const list = Array.isArray(records) ? records : [];
  const wanted = (Array.isArray(phrases) ? phrases : [phrases]).map(normalizeWords).filter(Boolean);
  if (!wanted.length) return null;
  let best = null;
  let bestScore = -1;
  for (const record of list) {
    const name = normalizeWords(record && (record.fondo || record.nombre));
    if (!name) continue;
    for (const phrase of wanted) {
      const words = phrase.split(' ').filter(Boolean);
      if (!words.every(word => name.includes(word))) continue;
      const exact = name === phrase ? 10000 : 0;
      const classBonus = /clase [a-z0-9]+$/.test(phrase) && name.endsWith(phrase.match(/clase [a-z0-9]+$/)[0]) ? 1000 : 0;
      const score = exact + classBonus + words.length * 10 - Math.abs(name.length - phrase.length);
      if (score > bestScore) {
        best = record;
        bestScore = score;
      }
    }
  }
  return best;
}

export function fciPeriodChange(latest, previous, units) {
  const current = finite(latest && (latest.vcp || latest.valorCuotaparte));
  const prior = finite(previous && (previous.vcp || previous.valorCuotaparte));
  const quantity = finite(units);
  if (current <= 0 || prior <= 0 || quantity <= 0) return null;
  return {
    amount: quantity * (current - prior),
    percent: (current - prior) / prior,
  };
}

export function quoteFreshness(asset, now = Date.now()) {
  if (!asset || !asset.quoteSource) return 'missing';
  if (asset.quoteQuality === 'manual') return 'manual';
  const timestamp = Date.parse(asset.quoteAsOf || asset.quoteFetchedAt || '');
  if (!Number.isFinite(timestamp)) return 'unknown';
  const hours = Math.max(0, (Number(now) - timestamp) / 3600000);
  const maxHours = asset.fci ? 96 : assetQuoteCurrency(asset) === 'USD' ? 6 : 72;
  if (hours > maxHours) return 'stale';
  if (asset.quoteQuality === 'delayed') return 'delayed';
  if (asset.quoteQuality === 'aggregated') return 'aggregated';
  return 'current';
}

export function applyAssetQuote(asset, quote) {
  const price = finite(quote && quote.price);
  if (!asset || price <= 0) return asset;
  const currentTimestamp = Date.parse(asset.quoteAsOf || asset.quoteFetchedAt || '');
  const nextTimestamp = Date.parse(quote.asOf || quote.fetchedAt || '');
  // A delayed public feed must never replace a newer value imported from the
  // broker. It can take over when its own observation catches up.
  if (Number.isFinite(currentTimestamp) && Number.isFinite(nextTimestamp) && nextTimestamp < currentTimestamp) return asset;
  return {
    ...asset,
    lastPrice: price,
    quoteCurrency: normalizeCurrency(quote.currency || asset.quoteCurrency),
    quoteSource: String(quote.source || asset.quoteSource || '').trim(),
    quoteQuality: String(quote.quality || asset.quoteQuality || 'delayed').trim(),
    quoteAsOf: quote.asOf || asset.quoteAsOf || null,
    quoteFetchedAt: quote.fetchedAt || new Date().toISOString(),
    quoteLastErrorAt: null,
  };
}
