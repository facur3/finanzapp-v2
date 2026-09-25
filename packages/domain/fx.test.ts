import { describe, expect, it } from 'vitest';
import { FX_PIVOT, RATE_MAX_AGE_DAYS, consolidatedLedger, convertMinor, convertOn, convertTotals, crossRate, isRateText, parseRate, quotesNeeded,
  rateBook, roundHalfAwayFromZero, type ExchangeRate } from './fx';
import type { Account, Entry, LedgerSnapshot, Transfer } from './ledger';
import { liquidTotalsByCurrency, type CreditCardProfile } from './liabilities';
import { summarizeMonthlyBudgets, type MonthlyBudget } from './budgets';
import { spendingReport } from './spending-report';
import { spendingOverview, spendingWindow } from './spending-overview';
import { monthlySpendingTrend, topMerchants } from './report-trend';

/** Producto 24C1: synthetic, deterministic rates only (no provider, no network). Figures are
 * invented for arithmetic, never presented as market history. */
const fetchedAt = '2026-09-20T12:00:00.000Z';
const rate = (quote: string, effectiveDate: string, value: string, source = 'Prueba'): ExchangeRate =>
  ({ base: 'USD', quote, rate: value, effectiveDate, source, fetchedAt });
const createdAt = '2026-09-01T12:00:00.000Z';
const account = (id: string, currency: string, openingMinor = 0): Account => ({ id, name: id, currency, openingMinor, createdAt });
const expense = (id: string, accountId: string, amountMinor: number, dateISO: string, category = 'Comida', merchant = 'Tienda'): Entry =>
  ({ id, accountId, kind: 'expense', amountMinor, merchant, category, dateISO, createdAt });

describe('rate text and exact arithmetic', () => {
  it('reads decimal text into an exact rational and refuses anything else', () => {
    expect(parseRate('1508.19')).toEqual({ num: 150819n, den: 100n });
    expect(parseRate('0.86598')).toEqual({ num: 86598n, den: 100000n });
    expect(parseRate('154')).toEqual({ num: 154n, den: 1n });
    for (const bad of ['', '0', '0.000', '-1', '1e5', '1,5', ' 1', '1.', '.5', 'NaN', '1.1234567890123', '1234567890123456789'])
      expect(isRateText(bad), bad).toBe(false);
    expect(isRateText('123456789012345678')).toBe(true);
    expect(isRateText('0.000000000001')).toBe(true);
  });

  it('rounds half away from zero, once', () => {
    expect(roundHalfAwayFromZero(5n, 2n)).toBe(3n);
    expect(roundHalfAwayFromZero(-5n, 2n)).toBe(-3n);
    expect(roundHalfAwayFromZero(7n, 3n)).toBe(2n);
    expect(roundHalfAwayFromZero(-7n, 3n)).toBe(-2n);
    expect(roundHalfAwayFromZero(149n, 100n)).toBe(1n);
    expect(roundHalfAwayFromZero(150n, 100n)).toBe(2n);
    expect(roundHalfAwayFromZero(-150n, 100n)).toBe(-2n);
    expect(roundHalfAwayFromZero(0n, 7n)).toBe(0n);
  });

  it('converts between exponents 0, 2 and 3 in both directions without floating point', () => {
    // 1 USD = 150.5 JPY: USD 10.01 → 1506.505 JPY → 1507 (half away from zero).
    expect(convertMinor(1001, 'USD', 'JPY', parseRate('150.5'))).toBe(1507);
    expect(convertMinor(-1001, 'USD', 'JPY', parseRate('150.5'))).toBe(-1507);
    // 1 JPY = 1/150.5 USD: JPY 1507 → 10.0132… USD → 1001 cents.
    expect(convertMinor(1507, 'JPY', 'USD', { num: 10n, den: 1505n })).toBe(1001);
    // 1 USD = 0.307 KWD: USD 1.00 → KWD 0.307 → 307 fils.
    expect(convertMinor(100, 'USD', 'KWD', parseRate('0.307'))).toBe(307);
    expect(convertMinor(307, 'KWD', 'USD', { num: 1000n, den: 307n })).toBe(100);
    // Half-way at the last digit: ARS 0.01 at 0.5 → 0.005 USD → 0.01.
    expect(convertMinor(1, 'ARS', 'USD', parseRate('0.5'))).toBe(1);
    expect(convertMinor(-1, 'ARS', 'USD', parseRate('0.5'))).toBe(-1);
    expect(convertMinor(1, 'ARS', 'USD', parseRate('0.49'))).toBe(0);
    // A figure that would leave the safe range is refused, never clamped.
    expect(convertMinor(Number.MAX_SAFE_INTEGER, 'USD', 'JPY', parseRate('1000'))).toBeNull();
    expect(() => convertMinor(0.5, 'USD', 'JPY', parseRate('1'))).toThrow('Monto inválido.');
  });

  it('computes a cross rate through the pivot exactly', () => {
    // 1 USD = 1500 ARS, 1 USD = 0.9 EUR → 1 ARS = 0.0006 EUR; ARS 1500.00 → EUR 0.90.
    const cross = crossRate(parseRate('1500'), parseRate('0.9'));
    expect(convertMinor(150000, 'ARS', 'EUR', cross)).toBe(90);
    expect(crossRate(null, parseRate('0.9'))).toEqual({ num: 9n, den: 10n });
  });
});

describe('the rate book', () => {
  const book = rateBook([
    rate('ARS', '2026-09-11', '1500'), // Friday
    rate('ARS', '2026-09-14', '1510'), // Monday
    rate('EUR', '2026-09-11', '0.9'),
    rate('EUR', '2026-09-14', '0.8'),
    rate('JPY', '2026-08-01', '150'),
    rate('ARS', '2026-09-14', '9999', 'Old'),                               // an older fetch of the same day loses
    { ...rate('ARS', '2026-09-15', '1'), base: 'EUR' },                    // another base is ignored
    rate('ARS', '2026-09-16', '1.5.5'),                                   // malformed text is ignored
  ].map((row, index) => index === 5 ? { ...row, fetchedAt: '2026-09-01T00:00:00.000Z' } : row));

  it('uses the latest publication on or before the day, within the age limit', () => {
    const saturday = book.lookup('ARS', '2026-09-12');
    expect(saturday.status === 'ok' && saturday.leg).toEqual({ quote: 'ARS', rate: '1500', effectiveDate: '2026-09-11', source: 'Prueba' });
    const monday = book.lookup('ARS', '2026-09-14');
    expect(monday.status === 'ok' && monday.leg.rate).toBe('1510');
    expect(book.lookup('ARS', '2026-09-10')).toEqual({ status: 'missing', quote: 'ARS', date: '2026-09-10', latest: '2026-09-14' });
    expect(book.lookup('JPY', '2026-08-08').status).toBe('ok');
    expect(book.lookup('JPY', '2026-08-09')).toEqual({ status: 'missing', quote: 'JPY', date: '2026-08-09', latest: '2026-08-01' });
    expect(RATE_MAX_AGE_DAYS).toBe(7);
    expect(book.lookup('KRW', '2026-09-14')).toEqual({ status: 'missing', quote: 'KRW', date: '2026-09-14' });
    expect(book.quotes()).toEqual(['ARS', 'EUR', 'JPY']);
  });

  it('converts on a day with both legs of that day, and says which leg is missing', () => {
    // Saturday: ARS 1500.00 at 1500 → USD 1.00 → EUR 0.90.
    expect(convertOn(book, 150000, 'ARS', 'EUR', '2026-09-12')).toEqual({ status: 'converted', minor: 90, legs: [
      { quote: 'ARS', rate: '1500', effectiveDate: '2026-09-11', source: 'Prueba' }, { quote: 'EUR', rate: '0.9', effectiveDate: '2026-09-11', source: 'Prueba' }] });
    // Monday: 1510 and 0.8 → ARS 1510.00 → EUR 0.80.
    expect(convertOn(book, 151000, 'ARS', 'EUR', '2026-09-14')).toMatchObject({ status: 'converted', minor: 80 });
    expect(convertOn(book, 151000, 'ARS', 'USD', '2026-09-14')).toMatchObject({ status: 'converted', minor: 100 });
    expect(convertOn(book, 100, 'USD', 'USD', '2026-01-01')).toEqual({ status: 'converted', minor: 100, legs: [] });
    expect(convertOn(book, 100, 'ARS', 'KRW', '2026-09-14')).toEqual({ status: 'missing', from: 'ARS', to: 'KRW', quote: 'KRW', date: '2026-09-14' });
    expect(convertOn(book, 100, 'JPY', 'ARS', '2026-09-14')).toEqual({ status: 'missing', from: 'JPY', to: 'ARS', quote: 'JPY', date: '2026-09-14', latest: '2026-08-01' });
  });
});

describe('consolidated views', () => {
  // ARS cash, USD cash, a EUR card, a JPY account; deterministic rates for three days.
  const accounts = [account('ars', 'ARS', 1000000), account('usd', 'USD', 50000), account('card', 'EUR'), account('yen', 'JPY', 100000)];
  const card: CreditCardProfile = { id: 'card-profile', accountId: 'card', issuer: 'Visa', last4: '1234', creditLimitMinor: null, closingDay: 20, dueDay: 5,
    active: true, createdAt, revision: 0, updatedAt: createdAt } as unknown as CreditCardProfile;
  const rows = [
    rate('ARS', '2026-08-31', '1400'), rate('EUR', '2026-08-31', '0.95'), rate('JPY', '2026-08-31', '140'),
    rate('ARS', '2026-09-10', '1500'), rate('EUR', '2026-09-10', '0.9'), rate('JPY', '2026-09-10', '150'),
    rate('ARS', '2026-09-20', '1600'), rate('EUR', '2026-09-20', '0.8'), rate('JPY', '2026-09-20', '160'),
  ];
  const book = rateBook(rows);
  const entries: Entry[] = [
    expense('a1', 'ars', 150000, '2026-09-10', 'Comida', 'Súper'),      // ARS 1500 @1500 → USD 1.00
    expense('a2', 'ars', 160000, '2026-09-20', 'Comida', 'Súper'),      // ARS 1600 @1600 → USD 1.00
    expense('u1', 'usd', 250, '2026-09-10', 'Transporte', 'Taxi'),      // USD 2.50
    expense('c1', 'card', 900, '2026-09-10', 'Comida', 'Súper'),        // EUR 9.00 @0.9 → USD 10.00 (a card purchase: one expense)
    expense('y1', 'yen', 1500, '2026-09-10', 'Viajes', 'Tren'),         // JPY 1500 @150 → USD 10.00
    expense('old', 'ars', 140000, '2026-08-31', 'Comida', 'Súper'),     // August: ARS 1400 @1400 → USD 1.00
    { ...expense('in', 'ars', 300000, '2026-09-10', 'Sueldo', 'Empresa'), kind: 'income' }, // ARS 3000 → USD 2.00
  ];
  // A card payment and an ARS → ARS transfer: transfers, never spending, in any view.
  const transfers: Transfer[] = [
    { id: 't1', fromAccountId: 'usd', toAccountId: 'card', amountMinor: 1000, note: 'Pago tarjeta', dateISO: '2026-09-15', createdAt },
    { id: 't2', fromAccountId: 'ars', toAccountId: 'ars2', amountMinor: 5000, note: '', dateISO: '2026-09-15', createdAt },
  ];
  const snapshot: LedgerSnapshot = { accounts: [...accounts, account('ars2', 'ARS')], entries, transfers };

  it('builds a ledger in the target currency from each movement\'s own date, never today\'s rate', () => {
    const view = consolidatedLedger(snapshot, 'USD', book);
    expect(view.unconverted).toEqual([]);
    expect(view.snapshot.accounts.every(item => item.currency === 'USD')).toBe(true);
    expect(view.snapshot.transfers).toEqual([]);
    expect(Object.fromEntries(view.snapshot.entries.map(entry => [entry.id, entry.amountMinor])))
      .toEqual({ a1: 100, a2: 100, u1: 250, c1: 1000, y1: 1000, old: 100, in: 200 });
    // The same September converted at today's rate (1600) would give 0.94 + 1.00: not what the view does.
    const report = spendingReport(view.snapshot, 'USD', '2026-09', '2026-09-25');
    expect(report.status === 'ready' && report.expenseMinor).toBe(100 + 100 + 250 + 1000 + 1000);
    expect(report.status === 'ready' && report.incomeMinor).toBe(200);
    // Categories add up to the total exactly (each movement rounded once, sums in integers).
    expect(report.categories.map(item => [item.key, item.amountMinor])).toEqual([['comida', 1200], ['transporte', 250], ['viajes', 1000]].sort((a, b) => (b[1] as number) - (a[1] as number)));
    expect(report.categories.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(report.status === 'ready' ? report.expenseMinor : -1);
    expect(view.provenance('2026-09-01', '2026-09-30')).toEqual({ converted: 5, oldest: '2026-09-10', newest: '2026-09-20', sources: ['Prueba'] });
    expect(view.foreign).toEqual(['ARS', 'EUR', 'JPY']);
  });

  it('gives the same September in ARS, USD, EUR and JPY, each exact in its own exponent', () => {
    const september = (target: string) => {
      const report = spendingReport(consolidatedLedger(snapshot, target, book).snapshot, target, '2026-09', '2026-09-25');
      return report.status === 'ready' ? report.expenseMinor : null;
    };
    // ARS: 1500 + 1600 + 2.50×1500 + 10×1500 + 10×1500 = 36850.00
    expect(september('ARS')).toBe(150000 + 160000 + 375000 + 1500000 + 1500000);
    // EUR: 0.90 + 0.80 + 2.25 + 9.00 + 9.00
    expect(september('EUR')).toBe(90 + 80 + 225 + 900 + 900);
    // JPY (no decimals): 150 + 160 + 375 + 1500 + 1500
    expect(september('JPY')).toBe(150 + 160 + 375 + 1500 + 1500);
    expect(september('USD')).toBe(2450);
  });

  it('never counts a transfer or a card payment as spending, and a card purchase once', () => {
    const view = consolidatedLedger(snapshot, 'ARS', book);
    const overview = spendingOverview(view.snapshot, spendingWindow('ARS', 'month', '2026-09-25'));
    expect(overview.status === 'ready' && overview.expenseCount).toBe(5);
    expect(view.snapshot.entries.filter(entry => entry.id === 'c1')).toHaveLength(1);
  });

  it('marks a period incomplete when one movement has no rate, and keeps the others', () => {
    const partial = rateBook(rows.filter(row => !(row.quote === 'JPY' && row.effectiveDate === '2026-09-10') && !(row.quote === 'JPY' && row.effectiveDate === '2026-08-31')));
    const view = consolidatedLedger(snapshot, 'USD', partial);
    expect(view.unconverted).toEqual([{ entryId: 'y1', kind: 'expense', currency: 'JPY', dateISO: '2026-09-10', reason: 'missing', quote: 'JPY', latest: '2026-09-20' }]);
    expect(view.complete('2026-09-01', '2026-09-30')).toBe(false);
    expect(view.complete('2026-09-01', '2026-09-30', 'income')).toBe(true);
    expect(view.complete('2026-08-01', '2026-08-31')).toBe(true);
    expect(view.complete('2026-09-11', '2026-09-30')).toBe(true);
    expect(view.missingIn('2026-09-01', '2026-09-30').map(item => item.entryId)).toEqual(['y1']);
  });

  it('keeps a stale rate out: a day more than a week after the last publication is unknown', () => {
    const late = { ...snapshot, entries: [...entries, expense('late', 'yen', 100, '2026-09-28')] };
    const view = consolidatedLedger(late, 'USD', book);
    expect(view.unconverted.map(item => [item.entryId, item.latest])).toEqual([['late', '2026-09-20']]);
  });

  it('measures a budget in the target currency against every currency converted, without counting anything twice', () => {
    const budgets: MonthlyBudget[] = [
      { id: 'b-total', scope: 'total', currency: 'USD', monthISO: '2026-09', amountMinor: 2000, active: true, createdAt, revision: 0, updatedAt: createdAt } as MonthlyBudget,
      { id: 'b-food', scope: 'category', category: 'Comida', currency: 'USD', monthISO: '2026-09', amountMinor: 1000, active: true, createdAt, revision: 0, updatedAt: createdAt } as MonthlyBudget,
      { id: 'b-ars', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 100, active: true, createdAt, revision: 0, updatedAt: createdAt } as MonthlyBudget,
    ];
    const summary = summarizeMonthlyBudgets(consolidatedLedger(snapshot, 'USD', book).snapshot, budgets, 'USD', '2026-09');
    expect(summary.total?.spentMinor).toBe(2450);
    expect(summary.rows.map(row => [row.budget.id, row.spentMinor])).toEqual([['b-food', 1200]]);
    // Filtered by the unconverted ledger, the USD budget sees only the USD account, as before 24C1.
    expect(summarizeMonthlyBudgets(snapshot, budgets, 'USD', '2026-09').total?.spentMinor).toBe(250);
  });

  it('keeps trend, comparison and merchants coherent with the converted total', () => {
    const view = consolidatedLedger(snapshot, 'USD', book).snapshot;
    const trend = monthlySpendingTrend(view, 'USD', '2026-09', '2026-09-25', 2);
    expect(trend.map(point => [point.monthISO, point.amountMinor])).toEqual([['2026-08', 100], ['2026-09', 2450]]);
    const report = spendingReport(view, 'USD', '2026-09', '2026-09-25');
    const merchants = topMerchants(view, report, 5);
    expect(merchants.map(item => [item.merchant, item.amountMinor])).toEqual([['Súper', 1200], ['Tren', 1000], ['Taxi', 250]]);
  });

  it('converts balances with the rate of the day asked for, apart from cards and debts, and gives no partial total', () => {
    const liquid = liquidTotalsByCurrency(snapshot, [card], []);
    expect(Object.keys(liquid)).toEqual(['ARS', 'USD', 'JPY']);
    const today = convertTotals(liquid, 'USD', book, '2026-09-25');
    expect(today.status).toBe('converted');
    // Balances: ARS 10000 − 1500 − 1600 − 1400 + 3000 = 8500.00 @1600 → 5.3125 → 5.31; USD 500 − 2.50 − 10 = 487.50; JPY 100000 − 1500 = 98500 @160 → 615.625 → 615.63.
    expect(today.status === 'converted' && today.minor).toBe(531 + 48750 + 61563);
    expect(today.status === 'converted' && today.provenance.newest).toBe('2026-09-20');
    const noYen = convertTotals(liquid, 'USD', rateBook(rows.filter(row => row.quote !== 'JPY')), '2026-09-25');
    expect(noYen.status).toBe('unknown');
    expect(noYen.status === 'unknown' && noYen.missing).toEqual([{ from: 'JPY', to: 'USD', quote: 'JPY', date: '2026-09-25' }]);
    expect(noYen.parts.map(part => [part.currency, part.minor])).toEqual([['ARS', 850000], ['USD', 48750], ['JPY', 98500]]);
    expect(convertTotals({ USD: -48750 }, 'USD', book, '2026-09-25')).toEqual({ status: 'single', currency: 'USD', minor: -48750, parts: [{ currency: 'USD', minor: -48750 }] });
    // A negative balance rounds symmetrically: ARS −1.00 @1600 → −0.000625 USD → −0.00.
    expect(convertTotals({ ARS: -100 }, 'USD', book, '2026-09-25')).toMatchObject({ status: 'converted', minor: 0 });
    expect(convertTotals({ ARS: -80000 }, 'USD', book, '2026-09-25')).toMatchObject({ status: 'converted', minor: -50 });
  });

  it('asks for no quote when nothing needs converting', () => {
    expect(quotesNeeded(['ARS'], 'ARS')).toEqual([]);
    expect(quotesNeeded(['USD'], 'USD')).toEqual([]);
    expect(quotesNeeded(['ARS'], 'USD')).toEqual(['ARS']);
    expect(quotesNeeded(['USD'], 'EUR')).toEqual(['EUR']);
    expect(quotesNeeded(['ARS', 'USD', 'JPY'], 'EUR')).toEqual(['ARS', 'EUR', 'JPY']);
    expect(FX_PIVOT).toBe('USD');
  });
});
