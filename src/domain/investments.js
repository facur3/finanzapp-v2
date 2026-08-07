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

const FCI_SPEND_PREFIX = 'fci-spend:';

export function fciSpendSourceId(accountId, asset) {
  const assetKey = String((asset && (asset.id || asset.ticker)) || '').trim();
  if (!accountId || !assetKey) return '';
  return FCI_SPEND_PREFIX + encodeURIComponent(String(accountId)) + ':' + encodeURIComponent(assetKey);
}

export function parseFciSpendSourceId(value) {
  const raw = String(value || '');
  if (!raw.startsWith(FCI_SPEND_PREFIX)) return null;
  const body = raw.slice(FCI_SPEND_PREFIX.length);
  const splitAt = body.indexOf(':');
  if (splitAt <= 0 || splitAt >= body.length - 1) return null;
  try {
    return {
      accountId: decodeURIComponent(body.slice(0, splitAt)),
      assetKey: decodeURIComponent(body.slice(splitAt + 1)),
    };
  } catch (_) {
    return null;
  }
}

export function spendableFciSources(state, usdRate = state && state.usdRate) {
  const accounts = (state && state.accounts) || {};
  const assets = (state && state.assets) || {};
  const archived = (state && state.archived) || {};
  const order = Array.isArray(state && state.order) ? state.order : Object.keys(accounts);
  const sources = [];
  for (const accountId of order) {
    const account = accounts[accountId];
    if (!account || account.kind !== 'invest' || archived[accountId]) continue;
    for (const asset of (assets[accountId] || [])) {
      if (!asset || !asset.fci) continue;
      const unitARS = assetUnitValueARS(asset, usdRate);
      const qty = finite(asset.qty != null ? asset.qty : asset.units);
      const valueARS = Math.max(0, qty * unitARS);
      sources.push({
        id: fciSpendSourceId(accountId, asset),
        accountId,
        assetId: asset.id || '',
        ticker: asset.ticker || '',
        name: asset.name || asset.ticker || 'FCI',
        emoji: asset.emoji || '◉',
        qty,
        unitARS,
        valueARS,
      });
    }
  }
  return sources;
}

export function findFciSpendSource(state, sourceId, usdRate = state && state.usdRate) {
  const parsed = parseFciSpendSourceId(sourceId);
  if (!parsed) return null;
  const assets = (state && state.assets && state.assets[parsed.accountId]) || [];
  const asset = assets.find(item => String(item && (item.id || item.ticker)) === parsed.assetKey && item && item.fci);
  if (!asset) return null;
  const qty = finite(asset.qty != null ? asset.qty : asset.units);
  const unitARS = assetUnitValueARS(asset, usdRate);
  return {
    id: String(sourceId),
    accountId: parsed.accountId,
    assetId: asset.id || '',
    ticker: asset.ticker || '',
    name: asset.name || asset.ticker || 'FCI',
    emoji: asset.emoji || '◉',
    qty,
    unitARS,
    valueARS: Math.max(0, qty * unitARS),
    asset,
  };
}

export function spendableFciValueARS(state, usdRate = state && state.usdRate) {
  return spendableFciSources(state, usdRate).reduce((sum, source) => sum + source.valueARS, 0);
}

// Redeeming an FCI to fund an expense changes the holding quantity but does not
// turn the fund into a bank account. Balances are intentionally left to the
// transaction layer: the expense already subtracts the same ARS amount from the
// investment container, while this helper keeps cuotapartes in sync.
export function redeemFciUnits(assetsByAccount, sourceId, amountARS, usdRate) {
  const parsed = parseFciSpendSourceId(sourceId);
  const amount = finite(amountARS);
  if (!parsed || amount <= 0) return { ok: false, error: 'invalid-source' };
  const current = Array.isArray(assetsByAccount && assetsByAccount[parsed.accountId]) ? assetsByAccount[parsed.accountId] : [];
  const index = current.findIndex(item => String(item && (item.id || item.ticker)) === parsed.assetKey && item && item.fci);
  if (index < 0) return { ok: false, error: 'missing-fund' };
  const asset = current[index];
  const unitARS = assetUnitValueARS(asset, usdRate);
  const currentQty = finite(asset.qty != null ? asset.qty : asset.units);
  const availableARS = currentQty * unitARS;
  if (!(unitARS > 0)) return { ok: false, error: 'missing-price' };
  if (amount > availableARS + 0.01) return { ok: false, error: 'insufficient', availableARS };
  const qty = Math.min(currentQty, amount / unitARS);
  const nextQty = Math.max(0, currentQty - qty);
  const nextAsset = { ...asset, qty: nextQty, units: nextQty };
  const accountAssets = current.slice();
  accountAssets[index] = nextAsset;
  return {
    ok: true,
    assets: { ...(assetsByAccount || {}), [parsed.accountId]: accountAssets },
    redemption: {
      sourceId: String(sourceId),
      accountId: parsed.accountId,
      assetId: asset.id || '',
      ticker: asset.ticker || '',
      name: asset.name || asset.ticker || 'FCI',
      qty,
      amountARS: amount,
      assetSnapshot: { ...asset },
    },
  };
}

export function restoreFciUnits(assetsByAccount, redemption) {
  if (!redemption || !redemption.accountId || !(finite(redemption.qty) > 0)) return assetsByAccount || {};
  const accountId = String(redemption.accountId);
  const current = Array.isArray(assetsByAccount && assetsByAccount[accountId]) ? assetsByAccount[accountId] : [];
  const key = String(redemption.assetId || redemption.ticker || '');
  let index = current.findIndex(item => String(item && (item.id || item.ticker)) === key);
  const accountAssets = current.slice();
  if (index < 0 && redemption.assetSnapshot) {
    accountAssets.push({ ...redemption.assetSnapshot, qty: finite(redemption.qty), units: finite(redemption.qty) });
  } else if (index >= 0) {
    const asset = accountAssets[index];
    const currentQty = finite(asset.qty != null ? asset.qty : asset.units);
    const nextQty = currentQty + finite(redemption.qty);
    accountAssets[index] = { ...asset, qty: nextQty, units: nextQty };
  }
  return { ...(assetsByAccount || {}), [accountId]: accountAssets };
}
