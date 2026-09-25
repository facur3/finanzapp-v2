import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HELD_CURRENCIES, LEDGER_CURRENCIES, accountBalanceMinor, archiveExponents, archiveKey, cardDebtMinor, createRecoveryBackup, currencyRecord, debtOutstandingMinor,
  deleteRecurringRule, displayDigits, initialRecord, makeEntryChange, maxWholeDigits, minorFromLedgerDraft, minorUnitExponent, parsePilotBackup, snapshotFromArchive,
  spendingOverview, summarizeMonthlyBudgets, totalsByCurrency, type Account, type CreditCardProfile, type CurrencyGate, type Entry, type IsoCurrencyCode,
  type MonthlyBudget, type PersonalDebtProfile, type RecurringRule, type Transfer } from '@finanzapp/domain';
import { bindLocale } from '../src/i18n/bind.ts';
import { REGIONS, composeLocale, type RegionCode } from '../src/i18n/locale.ts';
import { changeEntry, createAccount, createCreditCard, createEntry, createPersonalDebt, createTransfer, importArchive, initializeDatabase, processRecurring, readArchive,
  readSnapshot, saveMonthlyBudget, saveRecurringRule, type LedgerDatabase } from '../src/storage/database.ts';
import { PREVIEW_CURRENCIES } from '../src/storage/currency-gate.ts';
import { runExclusiveTransaction, runSchemaMigration, type TransactionConnection } from '../src/storage/transaction.ts';
import { AmountInput, readPastedAmount } from '../src/ui/money-input.ts';
import { offeredCurrencies } from '../src/ui/currencies.ts';

// Producto 24M: 144 currencies opened for creation (every `ready` fiat currency with 0 or 2 decimals), the seven
// three-decimal ones held. Every financial flow, in real SQLite, per class of currency: exponent 2 (EUR, GBP, CHF, INR),
// exponent 2 shown without decimals (COP, IDR), exponent 0 (JPY, CLP, KRW), and the held exponent 3 (KWD; IQD, shown
// without decimals) through the development preview gate. Synthetic records in disposable databases only.

function connection(path: string): TransactionConnection {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = OFF');
  return {
    execAsync: async sql => { db.exec(sql); },
    runAsync: async (sql, ...params) => ({ changes: Number(db.prepare(sql).run(...params).changes) }),
    getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) => { const row = db.prepare(sql).get(...params); return row ? { ...row } as T : null; },
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params).map(row => ({ ...row })) as T[],
    closeAsync: async () => { db.close(); },
  };
}
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
function fresh(): LedgerDatabase & { closeAsync(): Promise<void> } {
  const directory = mkdtempSync(join(tmpdir(), 'finanzapp-24m-'));
  const path = join(directory, 'ledger.sqlite');
  const base = connection(path);
  cleanups.push(async () => { await base.closeAsync(); rmSync(directory, { recursive: true, force: true }); });
  return { ...base, withExclusiveTransactionAsync: work => runExclusiveTransaction(async () => connection(path), work),
    withMigrationTransactionAsync: work => runSchemaMigration(async () => connection(path), work) };
}

const createdAt = '2026-08-01T12:00:00.000Z';
const changedAt = '2026-09-20T12:00:00.000Z';
/** One of each class of currency the release touches, and the held three-decimal ones through the preview gate. */
const CASES: { code: IsoCurrencyCode; gate: CurrencyGate }[] = [
  ...(['EUR', 'GBP', 'CHF', 'INR', 'COP', 'IDR', 'JPY', 'CLP', 'KRW'] as IsoCurrencyCode[]).map(code => ({ code, gate: LEDGER_CURRENCIES })),
  ...(['KWD', 'IQD'] as IsoCurrencyCode[]).map(code => ({ code, gate: PREVIEW_CURRENCIES })),
];

test('the gate the release opens: 144 new currencies, exponents 0 and 2; the held three-decimal ones only in the preview', () => {
  assert.equal(LEDGER_CURRENCIES.length - 2, 144);
  assert.deepEqual([...new Set(LEDGER_CURRENCIES.map(minorUnitExponent))].sort(), [0, 2]);
  assert.deepEqual(PREVIEW_CURRENCIES.filter(code => !LEDGER_CURRENCIES.includes(code)), Object.keys(HELD_CURRENCIES));
  for (const { code, gate } of CASES) assert.equal(gate.includes(code), true, code);
});

for (const { code, gate } of CASES) {
  test(`${code} (exponent ${minorUnitExponent(code)}, shown with ${displayDigits(code)}): accounts, movements, edits, undo, transfers, a card, a debt, budgets, a recurring rule, Home and Reportes totals, backup and restore — every amount exact in its own currency, never mixed with ARS`, async () => {
    const db = fresh();
    await initializeDatabase(db);
    const id = (name: string) => `${code.toLowerCase()}-${name}`;
    const cash: Account = { id: id('cash'), name: 'Caja ' + code, currency: code, openingMinor: 1234567, createdAt };
    const savings: Account = { ...cash, id: id('savings'), name: 'Ahorro ' + code, openingMinor: 0 };
    const pesos: Account = { id: 'ars-cash', name: 'Pesos', currency: 'ARS', openingMinor: 100000, createdAt };
    await createAccount(db, cash, undefined, gate);
    await createAccount(db, savings, undefined, gate);
    await createAccount(db, pesos, undefined, gate);
    // The scale is pinned on first use, from the catalogue; ARS never gains a unit row.
    assert.deepEqual(await db.getAllAsync<{ currency: string; minorUnitExponent: number }>('SELECT currency, minorUnitExponent FROM currency_units'),
      [{ currency: code, minorUnitExponent: minorUnitExponent(code) }]);
    const expense: Entry = { id: id('coffee'), accountId: cash.id, kind: 'expense', amountMinor: 12345, merchant: 'Café', category: 'Café', dateISO: '2026-09-10', createdAt };
    const income: Entry = { ...expense, id: id('refund'), kind: 'income', amountMinor: 500, merchant: 'Reintegro', category: 'Otros' };
    await createEntry(db, expense);
    await createEntry(db, income);
    await changeEntry(db, makeEntryChange(id('edit'), initialRecord(expense), 'edit', changedAt, { ...expense, amountMinor: 12346 }));
    await changeEntry(db, makeEntryChange(id('undo'), initialRecord(income), 'void', changedAt));
    // A negative balance: the savings account spends more than it holds.
    await createEntry(db, { ...expense, id: id('overdraft'), accountId: savings.id, amountMinor: 999 });
    await createTransfer(db, { id: id('move'), fromAccountId: cash.id, toAccountId: savings.id, amountMinor: 1000, note: '', dateISO: '2026-09-11', createdAt });
    // A transfer across currencies is refused and writes nothing.
    const before = archiveKey(await readArchive(db));
    await assert.rejects(createTransfer(db, { id: id('cross'), fromAccountId: cash.id, toAccountId: pesos.id, amountMinor: 1, note: '', dateISO: '2026-09-11', createdAt }), /misma moneda/);
    assert.equal(archiveKey(await readArchive(db)), before, 'a failed transaction leaves the ledger byte for byte');
    // A card in the currency: a purchase is one expense, the payment a transfer that is never a second expense.
    const cardAccount: Account = { id: id('card'), name: 'Tarjeta ' + code, currency: code, openingMinor: 0, createdAt };
    const card: CreditCardProfile = { id: id('card-profile'), accountId: cardAccount.id, issuer: 'Banco', last4: '4242', creditLimitMinor: 500000, closingDay: 28, dueDay: 5,
      active: true, createdAt, revision: 0, updatedAt: createdAt };
    await createCreditCard(db, cardAccount, card, gate);
    await createEntry(db, { ...expense, id: id('purchase'), accountId: cardAccount.id, amountMinor: 2310, dateISO: '2026-09-12' });
    await createTransfer(db, { id: id('card-payment'), fromAccountId: cash.id, toAccountId: cardAccount.id, amountMinor: 2000, note: '', dateISO: '2026-09-15', createdAt });
    // A debt in the currency, partly paid.
    const debtAccount: Account = { id: id('debt'), name: 'Debo', currency: code, openingMinor: -3000, createdAt };
    const debt: PersonalDebtProfile = { id: id('debt-profile'), accountId: debtAccount.id, direction: 'owed_by_me', counterparty: 'Ana', dueDateISO: '2026-10-01', note: '',
      active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
    await createPersonalDebt(db, debtAccount, debt, gate);
    await createTransfer(db, { id: id('debt-payment'), fromAccountId: cash.id, toAccountId: debtAccount.id, amountMinor: 1000, note: '', dateISO: '2026-09-16', createdAt });
    // A general budget and a category budget in the currency; a recurring rule recorded on its dates, then deleted (a deletion record).
    const total: MonthlyBudget = { id: id('budget'), scope: 'total', currency: code, monthISO: '2026-09', amountMinor: 50000, active: true, createdAt, revision: 0, updatedAt: createdAt };
    await saveMonthlyBudget(db, total, gate);
    await saveMonthlyBudget(db, { ...total, id: id('budget-cafe'), scope: 'category', category: 'Café', amountMinor: 20000 }, gate);
    const rule: RecurringRule = { id: id('rule'), accountId: cash.id, kind: 'expense', amountMinor: 777, merchant: 'Gimnasio', category: 'Salud', frequency: 'monthly',
      anchorDateISO: '2026-08-31', nextDateISO: '2026-08-31', active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
    await saveRecurringRule(db, rule);
    assert.equal(await processRecurring(db, '2026-09-30'), 2, 'August 31 and September 30');
    assert.equal(await processRecurring(db, '2026-09-30'), 0, 'never twice');
    await saveRecurringRule(db, deleteRecurringRule((await readArchive(db)).recurring![0], changedAt));

    const snapshot = await readSnapshot(db);
    const cashBalance = 1234567 - 12346 - 1000 - 2000 - 1000 - 777 * 2;
    assert.equal(accountBalanceMinor(cash, snapshot.entries, snapshot.transfers), cashBalance);
    assert.equal(accountBalanceMinor(savings, snapshot.entries, snapshot.transfers), 1000 - 999);
    assert.equal(cardDebtMinor(card, snapshot), 2310 - 2000);
    assert.equal(debtOutstandingMinor(debt, snapshot), 3000 - 1000);
    // Home and Reportes: one total per currency, never a sum across them.
    const totals = totalsByCurrency(snapshot);
    assert.deepEqual(Object.keys(totals).sort(), ['ARS', code].sort());
    assert.equal(totals.ARS, 100000, 'the pesos never moved');
    assert.equal(totals[code], cashBalance + 1 + (-(2310 - 2000)) + -(3000 - 1000));
    const overview = spendingOverview(snapshot, { currency: code, startISO: '2026-09-01', endISO: '2026-09-30' });
    assert.equal(overview.status === 'ready' ? overview.expenseMinor : null, 12346 + 999 + 2310 + 777, 'the purchase once, the payments never, the voided income out');
    const budgets = summarizeMonthlyBudgets(snapshot, (await readArchive(db)).budgets!, code, '2026-09');
    assert.equal(budgets.totalSpentMinor, 12346 + 999 + 2310 + 777);
    const pesosOverview = spendingOverview(snapshot, { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-30' });
    assert.equal(pesosOverview.status === 'ready' ? pesosOverview.expenseMinor : null, 0, 'nothing in the currency reaches the pesos view');

    // Export (v10: the deletion record), restore into a fresh device with the release gate, reopen: identical.
    const archive = await readArchive(db);
    assert.deepEqual(archiveExponents(archive), { ARS: 2, [code]: minorUnitExponent(code) });
    const backup = createRecoveryBackup(archive);
    assert.equal(backup.schema, 'finanzapp.native-pilot.v10');
    const other = fresh();
    await initializeDatabase(other);
    await importArchive(other, parsePilotBackup(JSON.stringify(backup)).archive, archiveKey(await readArchive(other)));
    const restored = await readArchive(other);
    assert.equal(archiveKey(restored), archiveKey(archive));
    assert.deepEqual(totalsByCurrency(snapshotFromArchive(restored)), totals);
    assert.equal(restored.recurring![0].deleted, true, 'the tombstone survives the round trip');
    assert.deepEqual(await other.getAllAsync('SELECT currency, minorUnitExponent FROM currency_units'), [{ currency: code, minorUnitExponent: minorUnitExponent(code) }]);
  });
}

test('amount limits per exponent: the largest amount a currency holds formats, types and pastes back exactly; one more digit is refused; negatives keep their sign', () => {
  for (const code of ['EUR', 'COP', 'JPY', 'KRW', 'KWD', 'IQD'] as IsoCurrencyCode[]) {
    const exponent = minorUnitExponent(code), whole = maxWholeDigits(code);
    assert.equal(whole + exponent, 15, code + ': fifteen digits in all, the safe-integer bound');
    const largest = Number('9'.repeat(whole + exponent));
    assert.ok(Number.isSafeInteger(largest));
    const i = bindLocale('es-AR');
    const shown = i.formatMoneyAmount(largest, code);
    const pasted = readPastedAmount(shown, i.amountFormat, code);
    assert.ok(pasted.ok && minorFromLedgerDraft(pasted.canonical, code) === largest, `${code} ${shown}`);
    const input = new AmountInput('', i.amountFormat, code);
    for (const key of '9'.repeat(whole + 1)) input.change(input.view.text + key, input.view.text.length + 1);
    assert.equal(input.draft.replace(/\D/g, '').length, whole, code + ': a digit past the limit never appears');
    assert.ok(i.moneyText(-largest, code).startsWith('−'), code);
    assert.equal(i.formatMoneyAmount(-1, code), exponent === 0 ? '-1' : '-0,' + '1'.padStart(exponent, '0'), code + ': the smallest negative amount');
  }
});

test('display rounding never touches a recorded amount; a chart scale rounds half up on the digits; zero-display currencies still show a recorded fraction', () => {
  const i = bindLocale('es-AR');
  assert.deepEqual([i.formatMoneyAmount(150000, 'COP'), i.formatMoneyAmount(150050, 'COP'), i.formatMoneyAmount(150000, 'IDR')], ['1.500', '1.500,5', '1.500'],
    'COP and IDR are shown without decimals unless a fraction was recorded');
  assert.deepEqual([i.formatMoneyAmount(1500500, 'IQD'), i.formatMoneyAmount(1500000, 'IQD')], ['1.500,5', '1.500'], 'IQD (held): exponent 3, shown with 0');
  assert.deepEqual([i.formatWholeUnits(149, 'EUR'), i.formatWholeUnits(150, 'EUR'), i.formatWholeUnits(-150, 'EUR'), i.formatWholeUnits(1499, 'JPY')], ['1', '2', '-2', '1.499']);
  assert.deepEqual([i.formatMoneyAmount(1, 'EUR'), i.formatMoneyAmount(1, 'JPY'), i.formatMoneyAmount(1, 'KWD')], ['0,01', '1', '0,001']);
});

test('symbols: every offered currency has its own symbol in every released region pair; a bare "$" is never evidence, a mismatched mark is refused, never converted', () => {
  for (const locale of ['es-AR', 'en-US', 'es-MX', 'en-GB'] as const) {
    const i = bindLocale(locale);
    const symbols = LEDGER_CURRENCIES.map(code => i.currencySymbol(code));
    assert.equal(new Set(symbols).size, symbols.length, locale + ': no two offered currencies share a symbol');
    assert.equal(symbols.filter(symbol => symbol === '$').length, locale === 'es-AR' ? 1 : 0, 'a bare "$" only for the peso in Argentina');
  }
  const format = bindLocale('es-AR').amountFormat;
  const read = (text: string, code: IsoCurrencyCode) => { const result = readPastedAmount(text, format, code); return result.ok ? result.canonical : result.reason; };
  assert.equal(read('€ 12,50', 'EUR'), '12,50');
  assert.equal(read('US$ 12,50', 'EUR'), 'currencyMismatch');
  assert.equal(read('JP¥ 1.500', 'JPY'), '1500');
  assert.equal(read('$ 1.500', 'CLP'), '1500', 'a bare "$" names nothing: stripped');
  assert.equal(read('12,5', 'JPY'), 'precision', 'yen have no decimals');
  assert.equal(read('CHF 1.000', 'EUR'), 'currencyMismatch');
  assert.equal(currencyRecord('CAD').symbol, 'CA$');
});

test('the eight regional number families write, type and read back every class of offered currency exactly; VoiceOver keeps the language\'s decimal and no grouping', () => {
  const regions: RegionCode[] = ['DE', 'GB', 'FR', 'SE', 'PL', 'CH', 'ES', 'IN'];
  for (const region of regions) for (const code of ['EUR', 'COP', 'JPY', 'INR'] as IsoCurrencyCode[]) for (const language of ['es', 'en'] as const) {
    const i = bindLocale(composeLocale(language, region));
    for (const minor of [1, 99, 123456, 1000000, 987654321012]) {
      const shown = i.formatMoneyAmount(minor, code);
      const pasted = readPastedAmount(shown, i.amountFormat, code);
      assert.ok(pasted.ok && minorFromLedgerDraft(pasted.canonical, code) === minor, `${region} ${code} ${shown}`);
    }
    const spoken = i.spokenMinor(123456, code);
    assert.equal(spoken, minorUnitExponent(code) === 0 ? '123456' : '1234' + (language === 'es' ? ',' : '.') + '56', `${region} ${code}`);
    assert.equal(REGIONS[region].group.length, 1);
  }
});

test('the chooser order: ARS and USD first, then by the name in the interface language; the preview only adds the held currencies', () => {
  const es = offeredCurrencies(LEDGER_CURRENCIES, 'es-AR'), en = offeredCurrencies(LEDGER_CURRENCIES, 'en-US');
  assert.deepEqual([es.slice(0, 2), en.slice(0, 2)], [['ARS', 'USD'], ['ARS', 'USD']]);
  assert.equal(es.indexOf('EUR') < es.indexOf('GBP'), true, 'Euros before Libras esterlinas');
  assert.equal(en.indexOf('GBP') < en.indexOf('EUR'), true, 'British Pound before Euro');
  assert.equal(offeredCurrencies(PREVIEW_CURRENCIES, 'es-AR').length, 153);
});
