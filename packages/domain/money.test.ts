import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { formatMinorUnits, parseMinorUnits } from './ledger';
import { editedDraftFits, isUnchangedStoredDraft, minorFromEditedDraft, minorFromLedgerDraft, MAX_AMOUNT_DIGITS, MAX_ENTRY_MINOR, addMoney, compareMoney, isEntryMinor, isStorableMinor, majorStringToMinor, maxWholeDigits,
  minorToMajorString, moneyAmount, negateMoney, parseLocalizedAmount, splitMinor, subtractMoney, sumMoney, type AmountReading } from './money';

// Node's own SQLite (the driver the mobile storage tests use); Vite cannot resolve it as an import.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const AR = { decimal: ',', group: '.' }, US = { decimal: '.', group: ',' };
const ok = (minor: number): AmountReading => ({ ok: true, minor });
const no = (reason: string) => ({ ok: false, reason });

describe('minor units and the currency exponent (Producto 24A)', () => {
  it('splits exactly for zero, two, three and four decimals', () => {
    expect(splitMinor(123456, 'USD')).toEqual({ negative: false, whole: '1234', fraction: '56' });
    expect(splitMinor(5, 'USD')).toEqual({ negative: false, whole: '0', fraction: '05' });
    expect(splitMinor(-5, 'ARS')).toEqual({ negative: true, whole: '0', fraction: '05' });
    expect(splitMinor(1500, 'JPY')).toEqual({ negative: false, whole: '1500', fraction: '' });
    expect(splitMinor(1500, 'KWD')).toEqual({ negative: false, whole: '1', fraction: '500' });
    expect(splitMinor(7, 'KWD')).toEqual({ negative: false, whole: '0', fraction: '007' });
    expect(splitMinor(12345, 'CLF')).toEqual({ negative: false, whole: '1', fraction: '2345' });
    expect(splitMinor(0, 'JPY')).toEqual({ negative: false, whole: '0', fraction: '' });
  });

  it('writes and reads the canonical machine form without floating point', () => {
    expect(minorToMajorString(123456, 'USD')).toBe('1234.56');
    expect(minorToMajorString(-1, 'USD')).toBe('-0.01');
    expect(minorToMajorString(1500, 'JPY')).toBe('1500');
    expect(minorToMajorString(1234567, 'KWD')).toBe('1234.567');
    expect(minorToMajorString(1, 'CLF')).toBe('0.0001');
    expect(majorStringToMinor('1234.56', 'USD')).toEqual(ok(123456));
    expect(majorStringToMinor('0.1', 'USD')).toEqual(ok(10));
    expect(majorStringToMinor('0.3', 'EUR')).toEqual(ok(30)); // 0.1 + 0.2 never happens here
    expect(majorStringToMinor('1234.567', 'KWD')).toEqual(ok(1234567));
    expect(majorStringToMinor('1500', 'JPY')).toEqual(ok(1500));
    expect(majorStringToMinor('1500.00', 'JPY')).toEqual(ok(1500));
    expect(majorStringToMinor('-0', 'USD')).toEqual(ok(0));
    expect(Object.is((majorStringToMinor('-0.00', 'USD') as { minor: number }).minor, 0)).toBe(true);
    for (const minor of [0, 1, -1, 99, 100, 101, 999999, 123456789012345, -123456789012345]) {
      for (const code of ['JPY', 'USD', 'KWD', 'CLF'] as const) {
        if (!isEntryMinor(minor)) continue;
        expect(majorStringToMinor(minorToMajorString(minor, code), code), `${minor} ${code}`).toEqual(ok(minor));
      }
    }
  });

  it('is exact where binary floating point is not (a float parser fails these)', () => {
    // 4.35 * 100 = 434.99999999999994, 0.29 * 100 = 28.999999999999996, 1.005 * 1000 = 1004.9999999999999,
    // 1.15 * 100 = 114.99999999999999, 9.95 * 100 = 994.9999999999999: truncation or rounding of those is wrong.
    expect(majorStringToMinor('4.35', 'USD')).toEqual(ok(435));
    expect(majorStringToMinor('0.29', 'USD')).toEqual(ok(29));
    expect(majorStringToMinor('1.15', 'EUR')).toEqual(ok(115));
    expect(majorStringToMinor('9.95', 'ARS')).toEqual(ok(995));
    expect(majorStringToMinor('1.005', 'KWD')).toEqual(ok(1005));
    expect(majorStringToMinor('8.575', 'BHD')).toEqual(ok(8575));
    expect(parseLocalizedAmount('4,35', 'USD', AR)).toEqual(ok(435));
    expect(parseLocalizedAmount('1.005', 'KWD', US)).toEqual(ok(1005));
    // Beyond 2^53 as a double, but below the 15-digit bound as digits: still exact.
    expect(majorStringToMinor('999999999999.999', 'KWD')).toEqual(ok(999999999999999));
    expect(minorToMajorString(435, 'USD')).toBe('4.35');
  });

  it('never rounds: extra decimals are refused unless they are zeros', () => {
    expect(majorStringToMinor('1.005', 'USD')).toEqual(no('precision'));
    expect(majorStringToMinor('1.0050', 'USD')).toEqual(no('precision'));
    expect(majorStringToMinor('1.0500', 'USD')).toEqual(ok(105));
    expect(majorStringToMinor('12.5', 'JPY')).toEqual(no('precision'));
    expect(majorStringToMinor('1.2345', 'KWD')).toEqual(no('precision'));
    expect(majorStringToMinor('1.23450', 'CLF')).toEqual(ok(12345));
    expect(majorStringToMinor('', 'USD')).toEqual(no('empty'));
    for (const text of ['1,5', '1.2.3', '+1', '1e3', '0x10', 'NaN', 'Infinity', '.5', '5.', ' - 1', '١٢٣', '1 000']) {
      expect(majorStringToMinor(text, 'USD'), text).toEqual(no('invalid'));
    }
  });

  it('bounds typed and converted amounts at 15 significant digits in every currency', () => {
    expect(MAX_AMOUNT_DIGITS).toBe(15);
    expect(MAX_ENTRY_MINOR).toBe(999_999_999_999_999);
    expect(MAX_ENTRY_MINOR).toBeLessThan(Number.MAX_SAFE_INTEGER);
    expect(maxWholeDigits('ARS')).toBe(13); // the amount field's limit since 23.1C1
    expect(maxWholeDigits('USD')).toBe(13);
    expect(maxWholeDigits('JPY')).toBe(15);
    expect(maxWholeDigits('KWD')).toBe(12);
    expect(maxWholeDigits('CLF')).toBe(11);
    expect(majorStringToMinor('9999999999999.99', 'USD')).toEqual(ok(999999999999999));
    expect(majorStringToMinor('10000000000000', 'USD')).toEqual(no('tooLong'));
    expect(majorStringToMinor('999999999999999', 'JPY')).toEqual(ok(999999999999999));
    expect(majorStringToMinor('1000000000000000', 'JPY')).toEqual(no('tooLong'));
    expect(majorStringToMinor('999999999999.999', 'KWD')).toEqual(ok(999999999999999));
    expect(majorStringToMinor('1000000000000', 'KWD')).toEqual(no('tooLong'));
    expect(majorStringToMinor('00000000000000001.5', 'USD'), 'leading zeros are not digits').toEqual(ok(150));
    expect(majorStringToMinor('1'.repeat(65), 'JPY')).toEqual(no('tooLong'));
  });

  it('stores any safe integer and refuses the rest instead of losing precision', () => {
    expect(isStorableMinor(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isStorableMinor(-Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isStorableMinor(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    for (const value of [0.5, NaN, Infinity, -Infinity, '1', null, 1e16]) expect(isStorableMinor(value), String(value)).toBe(false);
    expect(isEntryMinor(MAX_ENTRY_MINOR)).toBe(true);
    expect(isEntryMinor(MAX_ENTRY_MINOR + 1)).toBe(false);
    expect(isEntryMinor(-MAX_ENTRY_MINOR)).toBe(true);
    expect(isEntryMinor(-MAX_ENTRY_MINOR - 1)).toBe(false);
    // The largest stored amount still formats exactly in every exponent.
    expect(minorToMajorString(Number.MAX_SAFE_INTEGER, 'JPY')).toBe('9007199254740991');
    expect(minorToMajorString(Number.MAX_SAFE_INTEGER, 'USD')).toBe('90071992547409.91');
    expect(minorToMajorString(-Number.MAX_SAFE_INTEGER, 'KWD')).toBe('-9007199254740.991');
    expect(minorToMajorString(Number.MAX_SAFE_INTEGER, 'CLF')).toBe('900719925474.0991');
    expect(() => splitMinor(Number.MAX_SAFE_INTEGER + 1, 'USD')).toThrow('Monto inválido.');
    expect(() => splitMinor(1.5, 'USD')).toThrow('Monto inválido.');
    expect(() => splitMinor(1, 'XAU')).toThrow('Moneda no admitida.');
  });

  it('survives a real SQLite INTEGER column (STRICT, as the ledger uses) in every exponent', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE amounts (id INTEGER PRIMARY KEY, currency TEXT NOT NULL, minor_unit INTEGER NOT NULL, amount_minor INTEGER NOT NULL) STRICT');
    const insert = db.prepare('INSERT INTO amounts (currency, minor_unit, amount_minor) VALUES (?, ?, ?)');
    const rows = [moneyAmount(Number.MAX_SAFE_INTEGER, 'JPY'), moneyAmount(-Number.MAX_SAFE_INTEGER, 'USD'), moneyAmount(-123456789, 'KWD'),
      moneyAmount(MAX_ENTRY_MINOR, 'ARS'), moneyAmount(1, 'CLF'), moneyAmount(0, 'EUR')];
    for (const row of rows) insert.run(row.currency, splitMinor(0, row.currency).fraction.length, row.minor);
    const back = db.prepare('SELECT currency, minor_unit, amount_minor FROM amounts ORDER BY id').all() as { currency: string; minor_unit: number; amount_minor: number }[];
    expect(back.map(row => row.amount_minor)).toEqual(rows.map(row => row.minor));
    expect(back.map(row => row.minor_unit)).toEqual([0, 2, 3, 2, 4, 2]);
    expect(back.map(row => minorToMajorString(row.amount_minor, row.currency as 'JPY'))).toEqual(
      ['9007199254740991', '-90071992547409.91', '-123456.789', '9999999999999.99', '0.0001', '0.00']);
    // SQLite itself holds up to 2^63 − 1, but no JavaScript number can: node:sqlite refuses to read it as one (a driver
    // that converted silently would round it). FinanzApp never writes a value outside the safe range.
    db.prepare('INSERT INTO amounts (currency, minor_unit, amount_minor) VALUES (?, ?, ?)').run('USD', 2, 2n ** 53n + 1n);
    const big = db.prepare('SELECT amount_minor FROM amounts WHERE id = 7');
    big.setReadBigInts(true);
    expect((big.get() as { amount_minor: bigint }).amount_minor).toBe(2n ** 53n + 1n);
    big.setReadBigInts(false);
    expect(() => big.get()).toThrow();
    expect(isStorableMinor(Number(2n ** 53n + 1n))).toBe(false);
    db.close();
  });

  it('survives the representations storage will use (SQLite INTEGER, JSON)', () => {
    // 24B persists integer minor units plus the currency's scale; JSON and SQLite INTEGER hold every
    // safe integer exactly, so a stored amount comes back as the same number of minor units.
    const rows = [moneyAmount(Number.MAX_SAFE_INTEGER, 'JPY'), moneyAmount(-123456789, 'KWD'), moneyAmount(1, 'CLF'), moneyAmount(-99, 'ARS')]
      .map(amount => ({ amountMinor: amount.minor, currency: amount.currency, minorUnit: splitMinor(0, amount.currency).fraction.length }));
    const restored = JSON.parse(JSON.stringify(rows));
    expect(restored).toEqual(rows);
    expect(BigInt(restored[0].amountMinor)).toBe(9007199254740991n);
    expect(restored.map((row: { minorUnit: number }) => row.minorUnit)).toEqual([0, 3, 4, 2]);
  });
});

describe('localized amounts with explicit separators', () => {
  it('reads Argentine and US separators without guessing', () => {
    expect(parseLocalizedAmount('1.234,56', 'ARS', AR)).toEqual(ok(123456));
    expect(parseLocalizedAmount('1,234.56', 'USD', US)).toEqual(ok(123456));
    expect(parseLocalizedAmount('1.234', 'USD', AR)).toEqual(ok(123400)); // a thousand in Argentina
    expect(parseLocalizedAmount('1.234', 'USD', US)).toEqual(no('precision')); // one dollar and 0.234 in the US
    expect(parseLocalizedAmount('1.234', 'KWD', US)).toEqual(ok(1234)); // one dinar and 234 fils
    expect(parseLocalizedAmount('1.234', 'KWD', AR)).toEqual(ok(1234000));
    expect(parseLocalizedAmount('1.500', 'JPY', AR)).toEqual(ok(1500));
    expect(parseLocalizedAmount('1,5', 'JPY', AR)).toEqual(no('precision'));
    expect(parseLocalizedAmount('1,0', 'JPY', AR)).toEqual(ok(1));
    expect(parseLocalizedAmount('-12,5', 'USD', AR)).toEqual(ok(-1250));
    expect(parseLocalizedAmount('−12,5', 'USD', AR)).toEqual(ok(-1250));
    expect(parseLocalizedAmount('0012,5', 'USD', AR)).toEqual(ok(1250));
    for (const text of ['12.34', '1.23.456', '1..234', '.234', '1.234,', ',5', '1,2,3', '12 34', '--1', '$ 12', '1.234.5678', '01.234', '1234.567', '12345.678,9']) {
      expect(parseLocalizedAmount(text, 'USD', AR), text).toEqual(no('invalid'));
    }
    expect(parseLocalizedAmount('   ', 'USD', AR)).toEqual(no('empty'));
    expect(parseLocalizedAmount('9.999.999.999.999,99', 'ARS', AR)).toEqual(ok(999999999999999));
    expect(parseLocalizedAmount('10.000.000.000.000', 'ARS', AR)).toEqual(no('tooLong'));
    expect(() => parseLocalizedAmount('1', 'USD', { decimal: ',', group: ',' })).toThrow('Separadores inválidos.');
    expect(() => parseLocalizedAmount('1', 'USD', { decimal: '1', group: '.' })).toThrow('Separadores inválidos.');
  });

  it('agrees with the ledger parser for ARS and USD wherever both read Argentine separators', () => {
    const whole = ['0', '1', '12', '999', '1.000', '12.345', '999.999', '1.000.000', '9.999.999.999.999', '0007'];
    const fractions = ['', ',5', ',05', ',50', ',99'];
    for (const w of whole) for (const f of fractions) for (const sign of ['', '-']) {
      const text = sign + w + f;
      const ledger = (() => { try { return parseMinorUnits(text); } catch { return null; } })();
      const reading = parseLocalizedAmount(text, 'ARS', AR);
      if (ledger === null) expect(reading.ok, text).toBe(false);
      else expect(reading, text).toEqual(ok(ledger === 0 ? 0 : ledger));
    }
    // Everything the ledger's own formatter writes reads back as the same minor units.
    for (const minor of [0, 1, -1, 5, 99, 100, 123456, -123456, 100000000, 999999999999999, -999999999999999]) {
      expect(parseLocalizedAmount(formatMinorUnits(minor), 'ARS', AR), String(minor)).toEqual(ok(minor));
      expect(parseLocalizedAmount(formatMinorUnits(minor).replace(/[.,]/g, c => c === '.' ? ',' : '.'), 'USD', US), String(minor)).toEqual(ok(minor));
    }
  });
});

describe('money arithmetic in one currency', () => {
  it('adds, subtracts, negates and compares exactly', () => {
    expect(addMoney(moneyAmount(10, 'USD'), moneyAmount(20, 'USD'))).toEqual(moneyAmount(30, 'USD'));
    expect(subtractMoney(moneyAmount(10, 'KWD'), moneyAmount(25, 'KWD'))).toEqual(moneyAmount(-15, 'KWD'));
    expect(negateMoney(moneyAmount(0, 'JPY')).minor).toBe(0);
    expect(Object.is(negateMoney(moneyAmount(0, 'JPY')).minor, 0)).toBe(true);
    expect(compareMoney(moneyAmount(1, 'EUR'), moneyAmount(2, 'EUR'))).toBe(-1);
    expect(compareMoney(moneyAmount(2, 'EUR'), moneyAmount(2, 'EUR'))).toBe(0);
    expect(compareMoney(moneyAmount(3, 'EUR'), moneyAmount(2, 'EUR'))).toBe(1);
    expect(compareMoney(moneyAmount(-Number.MAX_SAFE_INTEGER, 'JPY'), moneyAmount(Number.MAX_SAFE_INTEGER, 'JPY'))).toBe(-1);
    // Ten cents three times is thirty cents, never 0.30000000000000004.
    expect(sumMoney([moneyAmount(10, 'USD'), moneyAmount(10, 'USD'), moneyAmount(10, 'USD')], 'USD').minor).toBe(30);
    expect(sumMoney([], 'JPY')).toEqual(moneyAmount(0, 'JPY'));
  });

  it('never combines two currencies (no exchange rate is ever assumed)', () => {
    const message = 'No se pueden combinar importes de monedas distintas sin una cotización.';
    expect(() => addMoney(moneyAmount(1, 'ARS'), moneyAmount(1, 'USD'))).toThrow(message);
    expect(() => subtractMoney(moneyAmount(1, 'USD'), moneyAmount(1, 'EUR'))).toThrow(message);
    expect(() => compareMoney(moneyAmount(1, 'JPY'), moneyAmount(1, 'KRW'))).toThrow(message);
    expect(() => sumMoney([moneyAmount(1, 'USD'), moneyAmount(1, 'ARS')], 'USD')).toThrow(message);
    expect(() => sumMoney([moneyAmount(1, 'USD')], 'ARS'), 'the total is in the currency asked for, or nothing').toThrow(message);
    expect(sumMoney([moneyAmount(1, 'USD')], 'USD').currency).toBe('USD');
  });

  it('accumulates in BigInt: only the final result has to be safe', () => {
    const max = moneyAmount(Number.MAX_SAFE_INTEGER, 'USD');
    expect(sumMoney([max, max, negateMoney(max)], 'USD').minor).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => addMoney(max, moneyAmount(1, 'USD'))).toThrow('El total supera el rango seguro.');
    expect(() => sumMoney([max, max], 'USD')).toThrow('El total supera el rango seguro.');
    expect(() => negateMoney(moneyAmount(-Number.MAX_SAFE_INTEGER, 'USD'))).not.toThrow();
  });

  it('refuses amounts that are not safe integers and currencies without a minor unit', () => {
    expect(() => moneyAmount(0.1, 'USD')).toThrow('Monto inválido.');
    expect(() => moneyAmount(Number.MAX_SAFE_INTEGER + 2, 'USD')).toThrow('Monto inválido.');
    expect(() => moneyAmount(NaN, 'USD')).toThrow('Monto inválido.');
    expect(() => moneyAmount(1, 'XXX')).toThrow('Moneda no admitida.');
    expect(Object.is(moneyAmount(-0, 'USD').minor, 0)).toBe(true);
    expect(() => sumMoney([{ minor: 0.5, currency: 'USD' }], 'USD')).toThrow('Monto inválido.');
  });

  it('refuses hand-built operands in every operation, not only in sums', () => {
    const unsafe = { minor: 2 ** 53, currency: 'USD' } as const, nan = { minor: NaN, currency: 'USD' } as const;
    const half = { minor: 0.5, currency: 'USD' } as const, gold = { minor: 1, currency: 'XAU' } as const;
    expect(() => addMoney(unsafe, moneyAmount(-1, 'USD'))).toThrow('Monto inválido.');
    expect(() => subtractMoney(unsafe, moneyAmount(1, 'USD'))).toThrow('Monto inválido.');
    expect(() => addMoney(half, moneyAmount(1, 'USD'))).toThrow('Monto inválido.');
    expect(() => negateMoney(nan)).toThrow('Monto inválido.');
    expect(() => compareMoney(nan, moneyAmount(5, 'USD'))).toThrow('Monto inválido.');
    expect(() => compareMoney(unsafe, { minor: 2 ** 53 + 1, currency: 'USD' })).toThrow('Monto inválido.');
    expect(() => compareMoney(gold, gold)).toThrow('Moneda no admitida.');
  });
});

describe('editing a stored amount (Producto 24B2 review fix)', () => {
  // A stored amount may exceed the entry bound and still be a valid safe integer (a balance is a sum of movements; a backup carries any safe integer).
  const large = MAX_ENTRY_MINOR + 12345;
  const stored = { minor: large, currency: 'ARS' as const, draft: '10.000.000.000.123,44' };
  it('keeps an untouched prefill exactly, whatever its size, and reads an edited text as a new entry with every rule', () => {
    expect(Number.isSafeInteger(large) && large > MAX_ENTRY_MINOR).toBe(true);
    expect(isUnchangedStoredDraft(stored.draft, 'ARS', stored)).toBe(true);
    expect(minorFromEditedDraft(stored.draft, 'ARS', stored)).toBe(large);
    expect(editedDraftFits(stored.draft, 'ARS', stored)).toEqual({ ok: true });
    // Any edit of the text goes through the entry bound and the decimals: never truncated, rounded or reinterpreted.
    expect(() => minorFromEditedDraft('10.000.000.000.123,45', 'ARS', stored)).toThrow('El monto es demasiado grande.');
    expect(editedDraftFits('10.000.000.000.123,45', 'ARS', stored)).toEqual({ ok: false, reason: 'tooLong' });
    expect(minorFromEditedDraft('500', 'ARS', stored)).toBe(50000);
    expect(minorFromEditedDraft('500', 'ARS', stored)).toBe(minorFromLedgerDraft('500', 'ARS'));
    expect(() => minorFromEditedDraft('12,345', 'ARS', stored)).toThrow('Usá números con hasta dos decimales.');
    // The same draft in another currency is not the stored amount: 12,50 pesos are never 1250 yen.
    expect(isUnchangedStoredDraft('12,50', 'JPY', { minor: 1250, currency: 'ARS', draft: '12,50' })).toBe(false);
    expect(() => minorFromEditedDraft('12,50', 'JPY', { minor: 1250, currency: 'ARS', draft: '12,50' })).toThrow('Usá números enteros: esta moneda no tiene decimales.');
    expect(editedDraftFits('12,50', 'JPY', { minor: 1250, currency: 'ARS', draft: '12,50' })).toEqual({ ok: false, reason: 'precision' });
    // Without a stored amount (a new record) both are exactly the entry functions.
    expect(minorFromEditedDraft('1.234,56', 'ARS', null)).toBe(123456);
    expect(() => minorFromEditedDraft(stored.draft, 'ARS', null)).toThrow('El monto es demasiado grande.');
    expect(editedDraftFits('12,5', 'JPY', undefined)).toEqual({ ok: false, reason: 'precision' });
    // A stored value that is not a safe integer is refused, never kept; the entry bound itself is unchanged.
    expect(() => minorFromEditedDraft('x', 'ARS', { minor: 2 ** 53, currency: 'ARS', draft: 'x' })).toThrow('Monto inválido.');
    expect(isStorableMinor(large)).toBe(true);
    expect(isEntryMinor(large)).toBe(false);
  });
});
