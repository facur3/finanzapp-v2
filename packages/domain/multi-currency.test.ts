import { describe, expect, it } from 'vitest';
import { CURRENCY_UNIT_SOURCE, ISO_4217_PUBLISHED, LEDGER_CURRENCIES, LEGACY_CURRENCIES, SCALE_CONFLICT_MESSAGE, UNIT_UNNEEDED_MESSAGE, catalogueUnit, currenciesNeedingUnits,
  currenciesWithStatus, isLedgerCurrency, isStorableCurrency, minorUnitExponent, pinnedExponent, validateCurrencyUnits, type IsoCurrencyCode } from './currency';
import { LEGACY_EXPORT_MESSAGE, accountBalanceMinor, accountIdsInCurrency, createPilotBackup, totalsByCurrency, validateAccount, validateNewAccount,
  validateTransfer, type Account, type Entry, type LedgerSnapshot, type Transfer } from './ledger';
import { MAX_ENTRY_MINOR, addMoney, compareMoney, maxWholeDigits, moneyAmount, parseLocalizedAmount, sumMoney } from './money';
import { debtTotalsByCurrency, liquidTotalsByCurrency, validateCreditCardChange, validatePersonalDebtChange, type CreditCardProfile, type PersonalDebtProfile } from './liabilities';
import { summarizeMonthlyBudgets, validateMonthlyBudget, validateNewMonthlyBudget, type MonthlyBudget } from './budgets';
import { summarizeMonth } from './month-summary';
import { expensesInPeriod, reportPeriod, spendingReport } from './spending-report';
import { spendingOverview, spendingWindow } from './spending-overview';
import { dailySpending, spendingComparison } from './report-insights';
import { monthlySpendingTrend, spendingInsights, topMerchants } from './report-trend';
import { recurringForecastByCurrency, validateRecurringRuleChange, type RecurringRule } from './recurring';
import { BACKUP_SCHEMA_V9, LEGACY_IMPORT_MESSAGE, archiveExponents, archiveKey, createRecoveryBackup, initialRecord, makeEntryChange, parsePilotBackup, previewBackupImport,
  validateArchive, validateEntryChange, type LedgerArchive } from './recovery';
import { initialTransferRecord, makeTransferChange, validateTransferChange } from './transfers';

/** Producto 24B1: synthetic fixtures in EUR (two decimals), JPY (none) and KWD (three) that never
 * enter the application. The production gate stays ARS/USD: these tests open creation with an
 * explicit gate and prove that reading, grouping, reporting and refusing work for any storable
 * currency, that no currency is dropped, zeroed or relabelled, and that ARS/USD results are
 * unchanged. Nothing here converts: every cross-currency operation must be refused. */
const GATE: readonly IsoCurrencyCode[] = ['ARS', 'USD', 'EUR', 'JPY', 'KWD'];
const at = '2026-09-11T12:00:00.000Z', day = '2026-09-11';
const cash = (id: string, currency: IsoCurrencyCode, openingMinor: number): Account => ({ id, name: 'Caja ' + currency, currency, openingMinor, createdAt: at });
const entry = (id: string, accountId: string, kind: Entry['kind'], amountMinor: number, category = 'Comida', dateISO = day): Entry =>
  ({ id, accountId, kind, amountMinor, merchant: 'Fixture ' + id, category, dateISO, createdAt: at });
const ars = cash('ars', 'ARS', 100000), usd = cash('usd', 'USD', 500), eur = cash('eur', 'EUR', 123456), jpy = cash('jpy', 'JPY', 1500), kwd = cash('kwd', 'KWD', 1234567);
const kwdCardAccount = cash('kwd-card', 'KWD', 0), eurDebtAccount = cash('eur-debt', 'EUR', -5000);
const kwdCard: CreditCardProfile = { id: 'card', accountId: kwdCardAccount.id, issuer: 'Banco', last4: '1234', creditLimitMinor: 500000, closingDay: 28, dueDay: 5, active: true, createdAt: at, revision: 0, updatedAt: at };
const eurDebt: PersonalDebtProfile = { id: 'debt', accountId: eurDebtAccount.id, direction: 'owed_by_me', counterparty: 'Ana', dueDateISO: null, note: '', active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at };
const entries: Entry[] = [
  entry('e-ars', 'ars', 'expense', 101), entry('e-jpy', 'jpy', 'expense', 700), entry('e-kwd', 'kwd', 'expense', 5, 'Transporte'),
  entry('e-kwd-2', 'kwd', 'expense', 1000), entry('i-eur', 'eur', 'income', 1), entry('e-card', 'kwd-card', 'expense', 250),
];
const transfer: Transfer = { id: 't-kwd', fromAccountId: 'kwd', toAccountId: 'kwd-card', amountMinor: 100, note: 'Pago', dateISO: day, createdAt: at };
const accounts = [ars, usd, eur, jpy, kwd, kwdCardAccount, eurDebtAccount];
const snapshot: LedgerSnapshot = { accounts, entries, transfers: [transfer] };
const kwdTotal: MonthlyBudget = { id: 'b-kwd', scope: 'total', currency: 'KWD', monthISO: '2026-09', amountMinor: 1000000, active: true, createdAt: at, revision: 0, updatedAt: at };
const jpyFood: MonthlyBudget = { id: 'b-jpy', scope: 'category', category: 'Comida', currency: 'JPY', monthISO: '2026-09', amountMinor: 500, active: true, createdAt: at, revision: 0, updatedAt: at };
const chfBudget: MonthlyBudget = { ...kwdTotal, id: 'b-chf', currency: 'CHF', amountMinor: 12000 }; // no account holds CHF (decision 7.6.3)
const rule: RecurringRule = { id: 'r-jpy', accountId: 'jpy', kind: 'expense', amountMinor: 300, merchant: 'Tren', category: 'Transporte', frequency: 'monthly',
  anchorDateISO: '2026-09-15', nextDateISO: '2026-09-15', active: true, deleted: false, createdAt: at, revision: 0, updatedAt: at };
const archive: LedgerArchive = { accounts, records: entries.map(initialRecord), transfers: [initialTransferRecord(transfer)], recurring: [rule],
  budgets: [kwdTotal, jpyFood, chfBudget], cards: [kwdCard], debts: [eurDebt] };
const legacyArchive: LedgerArchive = { accounts: [ars, usd], records: [initialRecord(entries[0])] };

describe('one gate for new records, read acceptance for stored ones', () => {
  it('production offers ARS, USD and (24M) every ready 0- or 2-decimal currency; the three-decimal ones only through an explicit gate', () => {
    expect(LEDGER_CURRENCIES).toHaveLength(146);
    expect([...LEGACY_CURRENCIES]).toEqual(['ARS', 'USD']);
    for (const account of [eur, jpy]) validateNewAccount(account);
    expect(() => validateNewAccount(kwd)).toThrow('Elegí una moneda disponible.');
    for (const account of [eur, jpy, kwd]) {
      validateNewAccount(account, GATE);
      validateAccount(account);
    }
    validateNewAccount(ars); validateNewAccount(usd);
    expect(() => validateNewMonthlyBudget(kwdTotal)).toThrow('Elegí una moneda disponible.');
    validateNewMonthlyBudget(kwdTotal, GATE);
    validateMonthlyBudget(kwdTotal);
    // A 'ready' (held) or 'incomplete' code outside the gate: storable, never offered.
    for (const code of ['KWD', 'VED', 'SVC'] as IsoCurrencyCode[]) {
      expect(isLedgerCurrency(code)).toBe(false);
      expect(isStorableCurrency(code)).toBe(true);
    }
    expect(currenciesWithStatus('ready').every(code => !isLedgerCurrency(code) && isStorableCurrency(code))).toBe(true);
  });

  it('shrinking the gate never locks stored data: the archive stays valid, readable, groupable and reportable', () => {
    validateArchive(archive); // The production gate is ARS/USD and the archive holds five currencies.
    expect(totalsByCurrency(snapshot)).toEqual({ ARS: 100000 - 101, USD: 500, EUR: 123456 + 1 - 5000, JPY: 1500 - 700, KWD: 1234567 - 5 - 1000 - 100 + 100 - 250 });
    expect(Object.keys(totalsByCurrency(snapshot))).toEqual(['ARS', 'USD', 'EUR', 'JPY', 'KWD']);
    expect(spendingOverview(snapshot, spendingWindow('KWD', 'month', day)).status).toBe('ready');
    expect(summarizeMonthlyBudgets(snapshot, archive.budgets!, 'KWD', '2026-09').totalSpentMinor).toBe(5 + 1000 + 250);
    expect(previewBackupImport({ accounts: [], records: [] }, archive).accounts).toHaveLength(7);
  });

  it('refuses codes that are not storable, in every shape they could arrive in', () => {
    for (const bad of ['ars', 'EURO', 'ZZZ', 'XAU', 'XXX', 'XTS', 'CLF', 'toString', '__proto__', '', ' ARS']) {
      const account = { ...ars, currency: bad as IsoCurrencyCode };
      expect(() => validateAccount(account), bad).toThrow('Moneda no admitida.');
      expect(() => validateNewAccount(account, [bad as IsoCurrencyCode]), bad).toThrow('Moneda no admitida.');
      expect(() => totalsByCurrency({ accounts: [account], entries: [] }), bad).toThrow('Moneda no admitida.');
      expect(() => liquidTotalsByCurrency({ accounts: [account], entries: [] }), bad).toThrow('Moneda no admitida.');
      expect(() => validateMonthlyBudget({ ...kwdTotal, currency: bad as IsoCurrencyCode }), bad).toThrow('Moneda no admitida.');
      expect(() => summarizeMonthlyBudgets(snapshot, [], bad as IsoCurrencyCode, '2026-09'), bad).toThrow('Moneda no admitida.');
      expect(() => spendingWindow(bad as IsoCurrencyCode, 'month', day), bad).toThrow('Moneda no admitida.');
      expect(() => spendingOverview(snapshot, { currency: bad as IsoCurrencyCode, startISO: day, endISO: day }), bad).toThrow('Moneda no admitida.');
      expect(() => reportPeriod(bad as IsoCurrencyCode, '2026-09', day), bad).toThrow('Moneda no admitida.');
      expect(() => expensesInPeriod(snapshot, { currency: bad as IsoCurrencyCode, startISO: day, endISO: day }), bad).toThrow('Moneda no admitida.');
      expect(() => summarizeMonth(snapshot, bad as IsoCurrencyCode, day), bad).toThrow('Moneda no admitida.');
      expect(() => accountIdsInCurrency(accounts, bad as IsoCurrencyCode), bad).toThrow('Moneda no admitida.');
    }
    // The month error stays its own sentence, apart from the currency's.
    expect(() => summarizeMonthlyBudgets(snapshot, [], 'KWD', '2026-13')).toThrow('Período de presupuesto inválido.');
  });
});

describe('groupings follow the currencies present', () => {
  it('a third currency never disappears, reads 0 or lands under ARS', () => {
    // The 24A audit probe: ARS 5 + JPY 700 used to return { ARS: 5 }.
    expect(totalsByCurrency({ accounts: [cash('a', 'ARS', 5), cash('j', 'JPY', 700)], entries: [] })).toEqual({ ARS: 5, JPY: 700 });
    expect(liquidTotalsByCurrency({ accounts: [cash('a', 'ARS', 5), cash('j', 'JPY', 700)], entries: [] })).toEqual({ ARS: 5, JPY: 700 });
    const liquid = liquidTotalsByCurrency(snapshot, [kwdCard], [eurDebt]);
    expect(liquid).toEqual({ ARS: 100000 - 101, USD: 500, EUR: 123456 + 1, JPY: 1500 - 700, KWD: 1234567 - 5 - 1000 - 100 });
    expect(Object.keys(liquid)).toEqual(['ARS', 'USD', 'EUR', 'JPY', 'KWD']);
    for (const currency of ['EUR', 'JPY', 'KWD'] as const) expect(Object.hasOwn(liquid, currency), currency).toBe(true);
    // A currency held only by a card has no liquid key: that absence is a true "no liquid account", not a dropped total.
    expect(liquidTotalsByCurrency({ accounts: [ars, kwdCardAccount], entries: [] }, [kwdCard], [])).toEqual({ ARS: 100000 });
    expect(liquidTotalsByCurrency({ accounts: [kwdCardAccount], entries: [] }, [kwdCard], [])).toEqual({});
    // Key order is ARS, USD, then by code, whatever order the accounts come in; an empty ledger is {}.
    expect(Object.keys(totalsByCurrency({ accounts: [kwd, jpy, usd, eur, ars], entries: [] }))).toEqual(['ARS', 'USD', 'EUR', 'JPY', 'KWD']);
    expect(Object.keys(totalsByCurrency({ accounts: [jpy, usd], entries: [] }))).toEqual(['USD', 'JPY']);
    expect(totalsByCurrency({ accounts: [], entries: [] })).toEqual({});
  });

  it('keeps the ARS/USD shapes and figures exactly as before', () => {
    expect(totalsByCurrency({ accounts: [ars, usd], entries: [entries[0]] })).toEqual({ ARS: 100000 - 101, USD: 500 });
    expect(Object.keys(totalsByCurrency({ accounts: [usd, ars], entries: [] }))).toEqual(['ARS', 'USD']);
    expect(liquidTotalsByCurrency({ accounts: [usd, ars], entries: [] })).toEqual({ ARS: 100000, USD: 500 });
  });

  it('an overflow in a third currency is refused, never skipped', () => {
    const big = { accounts: [ars, cash('k1', 'KWD', Number.MAX_SAFE_INTEGER), cash('k2', 'KWD', 1)], entries: [] };
    expect(() => totalsByCurrency(big)).toThrow('El total supera el rango seguro.');
    expect(() => liquidTotalsByCurrency(big)).toThrow('El saldo supera el rango seguro.');
    expect(() => validateArchive({ accounts: big.accounts, records: [] })).toThrow('rango seguro');
    expect(() => previewBackupImport({ accounts: [cash('k1', 'KWD', Number.MAX_SAFE_INTEGER)], records: [] }, { accounts: [cash('k2', 'KWD', 1)], records: [] })).toThrow('rango seguro');
  });

  it('debt and recurring totals are exact per currency and say when a currency leaves the range', () => {
    const debts = debtTotalsByCurrency([eurDebt, { ...eurDebt, id: 'd2', accountId: 'kwd-card', direction: 'owed_to_me' }], snapshot);
    expect(debts).toEqual([{ status: 'ready', currency: 'EUR', owedMinor: 5000, receivableMinor: 0 }, { status: 'ready', currency: 'KWD', owedMinor: 0, receivableMinor: 0 }]);
    const huge = { accounts: [cash('h', 'JPY', -Number.MAX_SAFE_INTEGER), cash('h2', 'JPY', -1)], entries: [] };
    const debtRows = debtTotalsByCurrency([{ ...eurDebt, id: 'h', accountId: 'h' }, { ...eurDebt, id: 'h2', accountId: 'h2' }], huge);
    expect(debtRows).toEqual([{ status: 'out-of-range', currency: 'JPY' }]);
    const forecast = recurringForecastByCurrency([rule, { ...rule, id: 'r-kwd', accountId: 'kwd', amountMinor: 1, kind: 'income' }], accounts, day, 30);
    expect(forecast).toEqual([{ status: 'ready', currency: 'JPY', expenseMinor: 300, incomeMinor: 0, count: 1 }, { status: 'ready', currency: 'KWD', expenseMinor: 0, incomeMinor: 1, count: 1 }]);
    expect(recurringForecastByCurrency([{ ...rule, amountMinor: Number.MAX_SAFE_INTEGER, frequency: 'weekly' }], accounts, day, 30)).toEqual([{ status: 'out-of-range', currency: 'JPY' }]);
    expect(recurringForecastByCurrency([{ ...rule, active: false }], accounts, day)).toEqual([]);
    expect(() => recurringForecastByCurrency([rule], accounts, '2026-02-30')).toThrow();
  });
});

describe('reports scope by the exact code and compute with exact money', () => {
  it('a JPY movement never leaks into an ARS report, and each currency reports its own exponent-free integers', () => {
    expect(spendingReport(snapshot, 'ARS', '2026-09', day)).toMatchObject({ status: 'ready', expenseMinor: 101, categories: [{ key: 'comida', amountMinor: 101, count: 1 }] });
    expect(spendingReport(snapshot, 'JPY', '2026-09', day)).toMatchObject({ status: 'ready', expenseMinor: 700, count: 1 });
    expect(spendingReport(snapshot, 'KWD', '2026-09', day)).toMatchObject({ status: 'ready', expenseMinor: 5 + 1000 + 250, count: 3 });
    expect(spendingReport(snapshot, 'EUR', '2026-09', day)).toMatchObject({ status: 'ready', expenseMinor: 0, incomeMinor: 1 });
    expect(spendingReport(snapshot, 'CHF', '2026-09', day)).toMatchObject({ status: 'ready', expenseMinor: 0, incomeMinor: 0, count: 0, categories: [] });
    const overview = spendingOverview(snapshot, spendingWindow('KWD', 'month', day));
    expect(overview.status === 'ready' && overview.expenseMinor).toBe(1255);
    expect(overview.categories.map(c => [c.key, c.amountMinor])).toEqual([['comida', 1250], ['transporte', 5]]);
    expect(dailySpending(snapshot, reportPeriod('KWD', '2026-09', day))).toEqual([{ dateISO: day, amountMinor: 1255, count: 3 }]);
    expect(monthlySpendingTrend(snapshot, 'JPY', '2026-09', day, 2).map(point => point.amountMinor)).toEqual([0, 700]);
    expect(topMerchants(snapshot, reportPeriod('KWD', '2026-09', day), 2).map(m => [m.merchant, m.amountMinor])).toEqual([['Fixture e-kwd-2', 1000], ['Fixture e-card', 250]]);
    expect(spendingComparison(snapshot, 'KWD', '2026-09', day).status).toBe('insufficient');
    expect(spendingInsights(snapshot, archive.budgets!, 'KWD', '2026-09', day, minor => String(minor)).map(i => i.id)).toEqual(['largest:e-kwd-2']);
    expect(summarizeMonth(snapshot, 'KWD', day)).toMatchObject({ status: 'ready', expenseMinor: 1255, incomeMinor: 0, count: 3 });
  });

  it('budgets keep their own currency, with or without an account in it', () => {
    const kwdSummary = summarizeMonthlyBudgets(snapshot, archive.budgets!, 'KWD', '2026-09');
    expect(kwdSummary.total).toMatchObject({ spentMinor: 1255, remainingMinor: 1000000 - 1255, exceeded: false });
    expect(kwdSummary.rows).toEqual([]);
    const jpySummary = summarizeMonthlyBudgets(snapshot, archive.budgets!, 'JPY', '2026-09');
    expect(jpySummary.rows.map(row => [row.budget.id, row.spentMinor, row.exceeded])).toEqual([['b-jpy', 700, true]]);
    const chfSummary = summarizeMonthlyBudgets(snapshot, archive.budgets!, 'CHF', '2026-09');
    expect(chfSummary.total).toMatchObject({ spentMinor: 0, remainingMinor: 12000 });
    expect(summarizeMonthlyBudgets(snapshot, archive.budgets!, 'ARS', '2026-09')).toMatchObject({ total: null, rows: [], totalSpentMinor: 101 });
  });

  it('a trend or merchant sum beyond the safe range is refused through the money model', () => {
    const wide: LedgerSnapshot = { accounts: [jpy], entries: [entry('x1', 'jpy', 'expense', Number.MAX_SAFE_INTEGER), { ...entry('x2', 'jpy', 'expense', 1), merchant: 'Fixture x1' }] };
    expect(() => monthlySpendingTrend(wide, 'JPY', '2026-09', day, 1)).toThrow('El total supera el rango seguro.');
    expect(() => topMerchants(wide, reportPeriod('JPY', '2026-09', day))).toThrow('El total supera el rango seguro.');
  });
});

describe('amounts are conserved exactly in every exponent, and currencies never mix', () => {
  it('stores whole yen, cents and fils as the integers recorded, up to the entry bound', () => {
    expect([minorUnitExponent('JPY'), minorUnitExponent('EUR'), minorUnitExponent('KWD')]).toEqual([0, 2, 3]);
    expect([maxWholeDigits('JPY'), maxWholeDigits('EUR'), maxWholeDigits('KWD')]).toEqual([15, 13, 12]);
    const separators = { decimal: ',', group: '.' };
    expect(parseLocalizedAmount('1.234,567', 'KWD', separators)).toEqual({ ok: true, minor: 1234567 });
    expect(parseLocalizedAmount('1.500', 'JPY', separators)).toEqual({ ok: true, minor: 1500 });
    expect(parseLocalizedAmount('12,5', 'JPY', separators)).toEqual({ ok: false, reason: 'precision' });
    expect(parseLocalizedAmount('1,2345', 'KWD', separators)).toEqual({ ok: false, reason: 'precision' });
    expect(parseLocalizedAmount('999.999.999.999.999', 'JPY', separators)).toEqual({ ok: true, minor: MAX_ENTRY_MINOR });
    expect(parseLocalizedAmount('1.000.000.000.000.000', 'JPY', separators)).toEqual({ ok: false, reason: 'tooLong' });
    expect(parseLocalizedAmount('999.999.999.999,999', 'KWD', separators)).toEqual({ ok: true, minor: MAX_ENTRY_MINOR });
    expect(accountBalanceMinor(kwd, entries, [transfer])).toBe(1234567 - 5 - 1000 - 100);
    expect(accountBalanceMinor(jpy, entries)).toBe(800);
    expect(sumMoney([moneyAmount(1, 'KWD'), moneyAmount(MAX_ENTRY_MINOR, 'KWD')], 'KWD').minor).toBe(MAX_ENTRY_MINOR + 1);
  });

  it('refuses every operation between two currencies', () => {
    const message = 'No se pueden combinar importes de monedas distintas sin una cotización.';
    expect(() => addMoney(moneyAmount(1, 'JPY'), moneyAmount(1, 'KWD'))).toThrow(message);
    expect(() => sumMoney([moneyAmount(1, 'EUR')], 'USD')).toThrow(message);
    expect(() => compareMoney(moneyAmount(1, 'ARS'), moneyAmount(1, 'EUR'))).toThrow(message);
    // A transfer between currencies, at creation and through an edit.
    expect(() => validateTransfer({ ...transfer, toAccountId: 'ars' }, accounts)).toThrow('Las dos cuentas deben tener la misma moneda.');
    expect(() => validateTransfer({ ...transfer, fromAccountId: 'jpy', toAccountId: 'kwd' }, accounts)).toThrow('Las dos cuentas deben tener la misma moneda.');
    const before = initialTransferRecord(transfer);
    const moved = makeTransferChange('c', before, 'edit', at, { ...transfer, fromAccountId: 'ars', toAccountId: 'usd' });
    expect(() => validateTransferChange(moved, accounts)).toThrow('Las dos cuentas deben tener la misma moneda.');
    const sameCode = makeTransferChange('c2', before, 'edit', at, { ...transfer, fromAccountId: 'kwd-card', toAccountId: 'kwd' });
    validateTransferChange(sameCode, accounts);
    // The guard behind the same-currency rule: even with a currency swap that keeps both legs consistent, the original currency stays.
    const swapped: LedgerArchive['transfers'] = [{ ...before, transfer: { ...transfer, fromAccountId: 'eur', toAccountId: 'eur-debt' } }];
    expect(() => validateTransferChange(makeTransferChange('c3', before, 'edit', at, swapped[0].transfer), accounts)).toThrow('Conservá la moneda original de la transferencia.');
    // A movement edited onto an account in another currency (recovery.ts).
    const record = initialRecord(entries[1]);
    expect(() => validateEntryChange(makeEntryChange('e', record, 'edit', at, { ...entries[1], accountId: 'kwd' }), accounts))
      .toThrow('Elegí una cuenta de la misma moneda. Un cambio de moneda necesita una operación separada.');
    validateEntryChange(makeEntryChange('e2', record, 'edit', at, { ...entries[1], amountMinor: 701 }), accounts);
    // A recurring rule moved to another currency, and a card or debt moved to another account.
    expect(() => validateRecurringRuleChange(rule, { ...rule, accountId: 'kwd', revision: 1 }, accounts)).toThrow('Elegí una cuenta de la misma moneda. Cambiar la moneda requiere crear otro recurrente.');
    validateRecurringRuleChange(rule, { ...rule, amountMinor: 301, revision: 1 }, accounts);
    expect(() => validateRecurringRuleChange(rule, { ...rule, revision: 2 }, accounts)).toThrow('El recurrente cambió desde que lo abriste. Volvé a revisarlo.');
    expect(() => validateCreditCardChange(kwdCard, { ...kwdCard, accountId: 'jpy', revision: 1 })).toThrow('La tarjeta cambió desde que la abriste. Volvé a revisarla.');
    validateCreditCardChange(kwdCard, { ...kwdCard, issuer: 'Otro', revision: 1 });
    expect(() => validatePersonalDebtChange(eurDebt, { ...eurDebt, direction: 'owed_to_me', revision: 1 })).toThrow('La deuda cambió desde que la abriste. Volvé a revisarla.');
    validatePersonalDebtChange(eurDebt, { ...eurDebt, note: 'x', revision: 1 });
  });
});

describe('backups: v1–v8 stay frozen to ARS/USD; v9 (24B4) records a scale per currency', () => {
  it('a ledger with another currency exports v9 with its pinned scales; a v1 export still refuses it; an ARS/USD ledger stays v8', () => {
    const backup = createRecoveryBackup(archive, new Date(at));
    expect(backup.schema).toBe(BACKUP_SCHEMA_V9);
    expect(backup.currencyUnits).toEqual([
      { currency: 'CHF', minorUnitExponent: 2, source: CURRENCY_UNIT_SOURCE, catalogVersion: ISO_4217_PUBLISHED },
      { currency: 'EUR', minorUnitExponent: 2, source: CURRENCY_UNIT_SOURCE, catalogVersion: ISO_4217_PUBLISHED },
      { currency: 'JPY', minorUnitExponent: 0, source: CURRENCY_UNIT_SOURCE, catalogVersion: ISO_4217_PUBLISHED },
      { currency: 'KWD', minorUnitExponent: 3, source: CURRENCY_UNIT_SOURCE, catalogVersion: ISO_4217_PUBLISHED },
    ]);
    expect(Object.keys(backup).at(-1)).toBe('currencyUnits');
    expect(createRecoveryBackup({ accounts: [ars], records: [], budgets: [chfBudget] }).currencyUnits).toEqual([catalogueUnit('CHF')]);
    expect(() => createPilotBackup({ accounts: [jpy], entries: [] })).toThrow(LEGACY_EXPORT_MESSAGE);
    expect(createRecoveryBackup(legacyArchive).schema).toBe('finanzapp.native-pilot.v8');
    expect('currencyUnits' in createRecoveryBackup(legacyArchive)).toBe(false);
    // The archive's own pinned units are written as they are (they equal the catalogue); a missing one comes from the catalogue.
    const pinned = { ...archive, currencyUnits: currenciesNeedingUnits(archive).map(code => code === 'JPY' ? { ...catalogueUnit(code), catalogVersion: '2025-01-01' } : catalogueUnit(code)) };
    expect(createRecoveryBackup(pinned).currencyUnits!.find(unit => unit.currency === 'JPY')?.catalogVersion).toBe('2025-01-01');
  });

  it('a v9 file round-trips every amount in zero, two and three decimals, and is refused whole for a wrong, missing, duplicate, unneeded or legacy unit', () => {
    const backup = createRecoveryBackup(archive);
    const restored = parsePilotBackup(JSON.stringify(backup)).archive;
    expect(restored.currencyUnits).toEqual(backup.currencyUnits);
    expect(archiveKey(restored)).toBe(archiveKey({ ...archive, currencyUnits: backup.currencyUnits }));
    expect(restored.records.map(record => record.entry.amountMinor).sort()).toEqual(entries.map(item => item.amountMinor).sort());
    expect(previewBackupImport({ ...archive, currencyUnits: backup.currencyUnits }, restored)).toMatchObject({ accounts: [], records: [], budgets: [], conflicts: 0, scaleConflicts: [], currencyUnits: [] });
    expect(archiveExponents(restored)).toEqual({ ARS: 2, USD: 2, CHF: 2, EUR: 2, JPY: 0, KWD: 3 });
    const units = backup.currencyUnits!;
    const withUnits = (currencyUnits: unknown) => JSON.stringify({ ...backup, currencyUnits });
    expect(() => parsePilotBackup(withUnits(units.map(unit => unit.currency === 'JPY' ? { ...unit, minorUnitExponent: 2 } : unit)))).toThrow(SCALE_CONFLICT_MESSAGE);
    expect(() => parsePilotBackup(withUnits(units.filter(unit => unit.currency !== 'KWD')))).toThrow('La moneda KWD no tiene una escala registrada. No se modificó nada.');
    expect(() => parsePilotBackup(withUnits([...units, units[0]]))).toThrow('La copia repite la escala de una moneda. No se importó nada.');
    expect(() => parsePilotBackup(withUnits([...units, catalogueUnit('GBP')]))).toThrow(UNIT_UNNEEDED_MESSAGE);
    expect(() => parsePilotBackup(withUnits([...units, { currency: 'ARS', minorUnitExponent: 2, source: 'x', catalogVersion: 'y' }]))).toThrow(UNIT_UNNEEDED_MESSAGE);
    expect(() => parsePilotBackup(withUnits(units.map(unit => ({ ...unit, extra: 1 }))))).toThrow('La copia contiene campos faltantes');
    expect(() => parsePilotBackup(withUnits(units.map(unit => ({ ...unit, source: '' }))))).toThrow('Origen de la escala inválido.');
    expect(() => parsePilotBackup(withUnits(units.map(unit => ({ ...unit, minorUnitExponent: 0.5 }))))).toThrow(SCALE_CONFLICT_MESSAGE);
    expect(() => parsePilotBackup(withUnits('nope'))).toThrow('escalas de moneda');
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, currencyUnits: undefined }))).toThrow('campos faltantes');
    // A v9 file whose rows are all ARS/USD carries an empty list, and a v8 file may not carry the key at all.
    const legacyV9 = { ...createRecoveryBackup(legacyArchive), schema: BACKUP_SCHEMA_V9, currencyUnits: [] };
    expect(parsePilotBackup(JSON.stringify(legacyV9)).archive).toEqual({ ...legacyArchive, currencyUnits: [] });
    expect(() => parsePilotBackup(JSON.stringify({ ...createRecoveryBackup(legacyArchive), currencyUnits: [] }))).toThrow('campos faltantes');
    // The unknown-version probe moves one up.
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, schema: 'finanzapp.native-pilot.v11' }))).toThrow('versiones 1 a 10');
  });

  it('a copy\'s pinned scale is identical, new or a conflict on this device; a scale that disagrees with the catalogue never reaches a preview', () => {
    const local: LedgerArchive = { ...legacyArchive, currencyUnits: [catalogueUnit('JPY')] };
    const incoming = parsePilotBackup(JSON.stringify(createRecoveryBackup({ accounts: [jpy], records: [initialRecord(entries[1])] }))).archive;
    const plan = previewBackupImport(local, incoming);
    expect(plan.currencyUnits).toEqual([]);
    expect(plan.scaleConflicts).toEqual([]);
    expect(plan.identical).toBe(1);
    expect(plan.accounts).toEqual([jpy]);
    expect(plan.after).toEqual({ ARS: 100000 - 101, USD: 500, JPY: 1500 - 700 });
    // A device that never pinned JPY receives the copy's unit in the plan, before the rows that need it.
    const fresh = previewBackupImport({ accounts: [], records: [], currencyUnits: [] }, incoming);
    expect(fresh.currencyUnits).toEqual([catalogueUnit('JPY')]);
    expect(fresh.after).toEqual({ JPY: 1500 - 700 });
    // Both sides are validated against the same catalogue before they are compared: a unit at another exponent
    // is refused by name, on either side, so no amount can be previewed or written at a scale the catalogue disowns.
    const forged = { ...incoming, currencyUnits: [{ ...catalogueUnit('JPY'), minorUnitExponent: 3 }] };
    expect(() => previewBackupImport(local, forged)).toThrow(SCALE_CONFLICT_MESSAGE);
    expect(() => previewBackupImport({ ...local, currencyUnits: [{ ...catalogueUnit('JPY'), minorUnitExponent: 2 }] }, incoming)).toThrow(SCALE_CONFLICT_MESSAGE);
    // Units count in the concurrency baseline only when present, so an ARS/USD ledger keeps its key.
    expect(archiveKey({ ...legacyArchive, currencyUnits: [] })).toBe(archiveKey(legacyArchive));
    expect(archiveKey(local)).not.toBe(archiveKey(legacyArchive));
  });

  it('an archive that knows its scales must pin every currency it uses beyond ARS/USD, at the catalogue exponent', () => {
    validateArchive({ accounts: [ars, usd], records: [], currencyUnits: [] });
    validateArchive({ accounts: [jpy], records: [], currencyUnits: [catalogueUnit('JPY')] });
    validateArchive({ accounts: [jpy], records: [], currencyUnits: [catalogueUnit('JPY'), catalogueUnit('KWD')] }); // storage tolerates a spare row
    expect(() => validateArchive({ accounts: [jpy], records: [], currencyUnits: [] })).toThrow('La moneda JPY no tiene una escala registrada.');
    expect(() => validateArchive({ accounts: [ars], records: [], budgets: [kwdTotal], currencyUnits: [] })).toThrow('La moneda KWD no tiene una escala registrada.');
    expect(() => validateArchive({ accounts: [jpy], records: [], currencyUnits: [{ ...catalogueUnit('JPY'), minorUnitExponent: 2 }] })).toThrow(SCALE_CONFLICT_MESSAGE);
    expect(() => archiveExponents({ accounts: [eur], currencyUnits: [] })).toThrow('La moneda EUR no tiene una escala registrada.');
    expect(archiveExponents({ accounts: [ars, usd] })).toEqual({ ARS: 2, USD: 2 });
    expect(pinnedExponent('KWD', [catalogueUnit('KWD')])).toBe(3);
    expect(() => pinnedExponent('KWD', [])).toThrow('La moneda KWD no tiene una escala registrada.');
    expect(pinnedExponent('USD', [])).toBe(2);
    expect(currenciesNeedingUnits(archive)).toEqual(['CHF', 'EUR', 'JPY', 'KWD']);
    expect(() => catalogueUnit('XAU')).toThrow('Moneda no admitida.');
    expect(() => validateCurrencyUnits([catalogueUnit('JPY')], ['JPY', 'KWD'])).toThrow('La moneda KWD no tiene una escala registrada.');
    expect(() => validateCurrencyUnits([catalogueUnit('JPY'), catalogueUnit('KWD')], ['JPY'], true)).toThrow(UNIT_UNNEEDED_MESSAGE);
    validateCurrencyUnits([catalogueUnit('JPY'), catalogueUnit('KWD')], ['JPY']);
  });

  it('a v1–v8 file naming another currency is refused whole, even with a wider gate and a storable code', () => {
    const backup = createRecoveryBackup(legacyArchive);
    for (const currency of ['JPY', 'EUR', 'KWD', 'CHF']) {
      const tampered = { ...backup, accounts: [{ ...backup.accounts[0], currency }] };
      expect(() => parsePilotBackup(JSON.stringify(tampered)), currency).toThrow(LEGACY_IMPORT_MESSAGE);
      expect(() => parsePilotBackup(JSON.stringify({ ...backup, budgets: [{ ...kwdTotal, currency }] })), currency).toThrow(LEGACY_IMPORT_MESSAGE);
      expect(() => parsePilotBackup(JSON.stringify({ ...tampered, schema: 'finanzapp.native-pilot.v1', entries: [], records: undefined })), currency).toThrow();
    }
    // Not storable at all: refused by the row's own rule, before the legacy rule.
    expect(() => parsePilotBackup(JSON.stringify({ ...backup, accounts: [{ ...backup.accounts[0], currency: 'XAU' }] }))).toThrow('Moneda no admitida.');
    expect(parsePilotBackup(JSON.stringify(backup)).archive).toEqual(legacyArchive);
  });

  it('an ARS/USD ledger exports the same v8 bytes and archive key as before 24B1', () => {
    const fixture: LedgerArchive = { accounts: [ars, usd], records: [initialRecord(entries[0])],
      transfers: [initialTransferRecord({ ...transfer, id: 't-ars', fromAccountId: 'ars', toAccountId: 'usd-x' })].filter(() => false),
      budgets: [{ ...kwdTotal, id: 'b-ars', currency: 'ARS' }] };
    const text = JSON.stringify(createRecoveryBackup(fixture, new Date(at)));
    expect(text).toBe('{"app":"FinanzApp","schema":"finanzapp.native-pilot.v8","exportedAt":"2026-09-11T12:00:00.000Z","moneyUnit":"integer-minor-units",'
      + '"accounts":[{"id":"ars","name":"Caja ARS","currency":"ARS","openingMinor":100000,"createdAt":"2026-09-11T12:00:00.000Z"},'
      + '{"id":"usd","name":"Caja USD","currency":"USD","openingMinor":500,"createdAt":"2026-09-11T12:00:00.000Z"}],'
      + '"records":[{"entry":{"id":"e-ars","accountId":"ars","kind":"expense","amountMinor":101,"merchant":"Fixture e-ars","category":"Comida","dateISO":"2026-09-11","createdAt":"2026-09-11T12:00:00.000Z"},"revision":0,"voided":false,"updatedAt":"2026-09-11T12:00:00.000Z"}],'
      + '"budgets":[{"id":"b-ars","scope":"total","currency":"ARS","monthISO":"2026-09","amountMinor":1000000,"active":true,"createdAt":"2026-09-11T12:00:00.000Z","revision":0,"updatedAt":"2026-09-11T12:00:00.000Z"}],'
      + '"transfers":[],"recurring":[],"cards":[],"debts":[],"appearances":[],"categories":[]}');
    expect(archiveKey(fixture)).toBe('{"accounts":[{"id":"ars","name":"Caja ARS","currency":"ARS","openingMinor":100000,"createdAt":"2026-09-11T12:00:00.000Z"},'
      + '{"id":"usd","name":"Caja USD","currency":"USD","openingMinor":500,"createdAt":"2026-09-11T12:00:00.000Z"}],'
      + '"records":[{"entry":{"id":"e-ars","accountId":"ars","kind":"expense","amountMinor":101,"merchant":"Fixture e-ars","category":"Comida","dateISO":"2026-09-11","createdAt":"2026-09-11T12:00:00.000Z"},"revision":0,"voided":false,"updatedAt":"2026-09-11T12:00:00.000Z"}],'
      + '"budgets":[{"id":"b-ars","scope":"total","currency":"ARS","monthISO":"2026-09","amountMinor":1000000,"active":true,"createdAt":"2026-09-11T12:00:00.000Z","revision":0,"updatedAt":"2026-09-11T12:00:00.000Z"}]}');
  });

  it('an import preview lists every currency of both ledgers, before and after', () => {
    const plan = previewBackupImport({ accounts: [ars, jpy], records: [] }, { accounts: [kwd, usd], records: [] });
    expect(plan.before).toEqual({ ARS: 100000, JPY: 1500 });
    expect(plan.after).toEqual({ ARS: 100000, USD: 500, JPY: 1500, KWD: 1234567 });
    expect(Object.keys(plan.after!)).toEqual(['ARS', 'USD', 'JPY', 'KWD']);
  });
});
