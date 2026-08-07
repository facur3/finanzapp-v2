const positive = (value, field, allowZero = false) => {
  const number = Number(value);
  if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) throw new Error('invalid-' + field);
  return number;
};

const text = (value, field, optional = false) => {
  const normalized = String(value ?? '').trim();
  if (!normalized && !optional) throw new Error('invalid-' + field);
  return normalized;
};

const list = value => Array.isArray(value) ? value : [];

function normalizeAccount(account) {
  const kind = ['liquid', 'invest', 'debt'].includes(account?.kind) ? account.kind : 'invest';
  const currency = ['ARS', 'USD'].includes(account?.currency) ? account.currency : 'ARS';
  return {
    id: text(account?.id, 'account-id'),
    name: text(account?.name, 'account-name'),
    type: text(account?.type || (kind === 'invest' ? 'Inversión' : 'Banco'), 'account-type'),
    kind,
    currency,
    liquid: kind === 'liquid' ? account?.liquid !== false : false,
    emoji: text(account?.emoji || (kind === 'invest' ? '📈' : '🏦'), 'account-emoji'),
    balance: positive(account?.balance ?? 0, 'account-balance', true),
    balanceKnown: account?.balanceKnown !== false,
  };
}
function normalizeCard(card) {
  const installments = list(card?.cuotas).map(item => {
    const cur = Math.max(1, Math.round(positive(item?.cur, 'installment-current')));
    const tot = Math.max(cur, Math.round(positive(item?.tot, 'installment-total')));
    return {
      name: text(item?.name, 'installment-name'),
      cur,
      tot,
      monto: positive(item?.monto, 'installment-amount'),
      date: text(item?.date, 'installment-date', true),
      dateISO: text(item?.dateISO, 'installment-date-iso', true),
    };
  });
  const purchases = list(card?.compras).map(item => ({
    name: text(item?.name, 'purchase-name'),
    monto: positive(item?.monto, 'purchase-amount'),
    date: text(item?.date, 'purchase-date', true),
    dateISO: text(item?.dateISO, 'purchase-date-iso', true),
  }));
  const payments = list(card?.pagos).map(item => ({
    name: text(item?.name || 'Pago de tarjeta', 'payment-name'),
    monto: positive(item?.monto, 'payment-amount'),
    date: text(item?.date, 'payment-date', true),
    dateISO: text(item?.dateISO, 'payment-date-iso', true),
  }));
  return {
    id: text(card?.id, 'card-id'),
    brand: text(card?.brand, 'card-brand'),
    bank: text(card?.bank, 'card-bank'),
    last4: text(card?.last4, 'card-last4'),
    saldo: positive(card?.saldo ?? 0, 'card-balance', true),
    limit: positive(card?.limit, 'card-limit'),
    cierre: text(card?.cierre, 'card-close'),
    vence: text(card?.vence, 'card-due'),
    previousClose: text(card?.previousClose, 'card-previous-close', true),
    previousDue: text(card?.previousDue, 'card-previous-due', true),
    paidCycle: text(card?.paidCycle, 'card-paid-cycle', true),
    grad: text(card?.grad, 'card-gradient', true),
    autopay: !!card?.autopay,
    autopayAccount: text(card?.autopayAccount, 'card-autopay-account', true),
    compras: purchases,
    cuotas: installments,
    pagos: payments,
  };
}

function normalizeAsset(asset) {
  const costUnknown = !!asset?.costUnknown;
  const quoteCurrency = ['ARS', 'USD'].includes(String(asset?.quoteCurrency || '').toUpperCase()) ? String(asset.quoteCurrency).toUpperCase() : 'ARS';
  const costCurrency = ['ARS', 'USD'].includes(String(asset?.costCurrency || '').toUpperCase()) ? String(asset.costCurrency).toUpperCase() : quoteCurrency;
  return {
    accountId: text(asset?.accountId, 'asset-account'),
    id: text(asset?.id, 'asset-id'),
    ticker: text(asset?.ticker, 'asset-ticker'),
    name: text(asset?.name, 'asset-name'),
    emoji: text(asset?.emoji || '📈', 'asset-emoji'),
    qty: positive(asset?.qty, 'asset-quantity'),
    avg: costUnknown ? positive(asset?.avg ?? asset?.lastPrice, 'asset-average') : positive(asset?.avg, 'asset-average'),
    lastPrice: positive(asset?.lastPrice ?? asset?.avg, 'asset-last-price'),
    quoteTicker: text(asset?.quoteTicker || asset?.ticker, 'asset-quote-ticker'),
    arsQuoteTicker: text(asset?.arsQuoteTicker, 'asset-ars-quote-ticker', true),
    lastPriceARS: positive(asset?.lastPriceARS ?? 0, 'asset-last-price-ars', true),
    quoteCurrency,
    costCurrency,
    unitDivisor: positive(asset?.unitDivisor ?? 1, 'asset-unit-divisor'),
    priceProvider: text(asset?.priceProvider, 'asset-price-provider', true),
    quoteSource: text(asset?.quoteSource, 'asset-quote-source', true),
    quoteQuality: text(asset?.quoteQuality, 'asset-quote-quality', true),
    quoteAsOf: text(asset?.quoteAsOf, 'asset-quote-as-of', true),
    quoteFetchedAt: text(asset?.quoteFetchedAt, 'asset-quote-fetched-at', true),
    fci: !!asset?.fci,
    fondoMatch: list(asset?.fondoMatch).map(value => text(value, 'fund-match')).filter(Boolean),
    fundSlug: text(asset?.fundSlug, 'fund-slug', true),
    officialRateSlug: text(asset?.officialRateSlug, 'official-rate-slug', true),
    estimatedAnnualRate: positive(asset?.estimatedAnnualRate ?? 0, 'asset-estimated-rate', true),
    estimatedAnnualRateAsOf: text(asset?.estimatedAnnualRateAsOf, 'asset-estimated-rate-as-of', true),
    estimatedAnnualRateSource: text(asset?.estimatedAnnualRateSource, 'asset-estimated-rate-source', true),
    costUnknown,
    unitsEstimated: !!asset?.unitsEstimated,
    quantitySource: text(asset?.quantitySource, 'asset-quantity-source', true),
  };
}

function normalizeLot(lot) {
  return {
    importKey: text(lot?.importKey, 'lot-key'),
    accountId: text(lot?.accountId, 'lot-account'),
    ticker: text(lot?.ticker, 'lot-ticker'),
    name: text(lot?.name || lot?.ticker, 'lot-name'),
    qty: positive(lot?.qty, 'lot-quantity'),
    total: positive(lot?.total, 'lot-total'),
    currency: ['ARS', 'USD'].includes(String(lot?.currency || '').toUpperCase()) ? String(lot.currency).toUpperCase() : 'ARS',
    unitDivisor: positive(lot?.unitDivisor ?? 1, 'lot-unit-divisor'),
    dateISO: text(lot?.dateISO, 'lot-date'),
    note: text(lot?.note, 'lot-note', true),
  };
}

function normalizeRecurring(item) {
  const type = item?.type === 'ingreso' ? 'ingreso' : 'gasto';
  const targetKind = item?.targetKind === 'card' ? 'card' : 'account';
  return {
    id: text(item?.id, 'recurring-id'),
    type,
    concept: text(item?.concept, 'recurring-concept'),
    amount: positive(item?.amount, 'recurring-amount'),
    cat: text(item?.cat || (type === 'ingreso' ? 'ingreso' : 'otros'), 'recurring-category'),
    targetKind,
    targetId: text(item?.targetId, 'recurring-target'),
    day: Math.min(31, Math.max(1, Math.round(positive(item?.day, 'recurring-day')))),
    active: item?.active !== false,
    nextDate: text(item?.nextDate, 'recurring-next-date', true),
  };
}

export function parseSetupImport(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!parsed || parsed.app !== 'FinanzApp' || parsed.schema !== 'finanzapp.setup.v1' || !parsed.setup) {
    throw new Error('invalid-setup');
  }
  return {
    version: Number(parsed.version) || 1,
    exportedAt: text(parsed.exportedAt, 'exported-at', true),
    setup: {
      accounts: list(parsed.setup.accounts).map(normalizeAccount),
      cards: list(parsed.setup.cards).map(normalizeCard),
      assets: list(parsed.setup.assets).map(normalizeAsset),
      investmentLots: list(parsed.setup.investmentLots).map(normalizeLot),
      recurring: list(parsed.setup.recurring).map(normalizeRecurring),
    },
    reviewNeeded: list(parsed.reviewNeeded).map(item => String(item).trim()).filter(Boolean),
  };
}
