import { describe, expect, it } from 'vitest';
import { CLDR_VERSION, CURRENCY_CODES, ISO_4217_PUBLISHED, LEDGER_CURRENCIES, LEGACY_CURRENCIES, LEGACY_EXPONENT, currenciesWithStatus, currencyRecord, currencyStatus,
  displayDigits, hasMinorUnit, isIsoCurrencyCode, isLedgerCurrency, minorUnitExponent, storedExponent, type IsoCurrencyCode } from './currency';
import { validateAccount, type Account } from './ledger';

const account = (currency: string): Account => ({ id: 'a', name: 'Caja', currency: currency as Account['currency'], openingMinor: 0, createdAt: '2026-01-01T12:00:00Z' });

describe('currency catalogue (Producto 24A)', () => {
  it('names its sources and covers ISO 4217 List One', () => {
    expect(ISO_4217_PUBLISHED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CLDR_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(CURRENCY_CODES.length).toBeGreaterThan(170);
    expect([...CURRENCY_CODES]).toEqual([...CURRENCY_CODES].sort());
    expect(new Set(CURRENCY_CODES).size).toBe(CURRENCY_CODES.length);
    for (const code of CURRENCY_CODES) {
      const record = currencyRecord(code);
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(record.numeric).toMatch(/^\d{3}$/);
      if (record.kind === 'fiat' || record.kind === 'fund') expect([0, 1, 2, 3, 4]).toContain(record.minorUnit);
      else expect(record.minorUnit).toBeNull();
    }
    const numerics = CURRENCY_CODES.map(code => currencyRecord(code).numeric);
    expect(new Set(numerics).size).toBe(numerics.length);
  });

  it('keeps ARS and USD exactly as the ledger has always stored them', () => {
    expect([...LEDGER_CURRENCIES]).toEqual(['ARS', 'USD']);
    for (const code of LEDGER_CURRENCIES) {
      expect(minorUnitExponent(code)).toBe(LEGACY_EXPONENT);
      expect(displayDigits(code)).toBe(2);
      expect(currencyStatus(code)).toBe('ledger');
    }
    expect(currencyRecord('ARS').numeric).toBe('032');
    expect(currencyRecord('USD').numeric).toBe('840');
    expect(currencyRecord('USD').symbol).toBe('US$');
    expect(currencyRecord('ARS').narrowSymbol).toBe('$');
  });

  it('the ledger accepts exactly the ledger currencies, whatever the catalogue knows', () => {
    for (const code of CURRENCY_CODES) {
      const accepted = (() => { try { validateAccount(account(code)); return true; } catch { return false; } })();
      expect(accepted, code).toBe(isLedgerCurrency(code));
    }
    expect(() => validateAccount(account('EUR'))).toThrow('Elegí ARS o USD.');
    expect(isLedgerCurrency('ars')).toBe(false);
    expect(isLedgerCurrency(undefined)).toBe(false);
  });

  it('gives every code one availability status', () => {
    const statuses = ['ledger', 'ready', 'incomplete', 'excluded'] as const;
    const all = statuses.flatMap(status => currenciesWithStatus(status));
    expect(all.sort()).toEqual([...CURRENCY_CODES]);
    expect(currenciesWithStatus('ledger')).toEqual(['ARS', 'USD']);
    for (const code of currenciesWithStatus('excluded')) expect(currencyRecord(code).kind).not.toBe('fiat');
    for (const code of currenciesWithStatus('ready', 'incomplete', 'ledger')) expect(currencyRecord(code).kind).toBe('fiat');
    for (const code of currenciesWithStatus('incomplete')) expect(currencyRecord(code).missing.length).toBeGreaterThan(0);
    for (const code of currenciesWithStatus('ready', 'ledger')) expect(currencyRecord(code).missing).toEqual([]);
  });

  it('excludes funds, metals, units of account, the test code and XXX', () => {
    for (const code of ['BOV', 'CLF', 'COU', 'MXV', 'USN', 'UYI', 'UYW', 'CHE', 'CHW', 'XAD', 'XAU', 'XAG', 'XPT', 'XPD', 'XDR', 'XSU', 'XUA',
      'XBA', 'XBB', 'XBC', 'XBD', 'XTS', 'XXX'] as IsoCurrencyCode[]) {
      expect(currencyStatus(code), code).toBe('excluded');
    }
  });

  it('language-neutral symbols name one fiat currency each', () => {
    const seen = new Map<string, string>();
    for (const code of CURRENCY_CODES.filter(item => currencyRecord(item).kind === 'fiat')) {
      const { symbol } = currencyRecord(code);
      if (symbol === code) continue;
      expect(seen.get(symbol), `${symbol} is ${seen.get(symbol)} and ${code}`).toBeUndefined();
      seen.set(symbol, code);
    }
  });

  it('knows the exponent of currencies with zero, two, three and four decimals', () => {
    expect(minorUnitExponent('JPY')).toBe(0);
    expect(minorUnitExponent('CLP')).toBe(0);
    expect(minorUnitExponent('KRW')).toBe(0);
    expect(minorUnitExponent('EUR')).toBe(2);
    for (const code of ['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'] as IsoCurrencyCode[]) expect(minorUnitExponent(code), code).toBe(3);
    expect(minorUnitExponent('CLF')).toBe(4);
    expect(minorUnitExponent('UYW')).toBe(4);
    expect(() => minorUnitExponent('XAU')).toThrow('Moneda no admitida.');
    expect(hasMinorUnit('XAU')).toBe(false);
    expect(hasMinorUnit('JPY')).toBe(true);
    // Display digits never exceed the exponent; CLDR shows fewer for some (IQD: 3 → 0, IDR: 2 → 0).
    expect(displayDigits('IQD')).toBe(0);
    expect(displayDigits('IDR')).toBe(0);
    expect(displayDigits('KWD')).toBe(3);
    for (const code of CURRENCY_CODES.filter(hasMinorUnit)) expect(displayDigits(code)).toBeLessThanOrEqual(minorUnitExponent(code));
  });

  it('pins every storable exponent: a data update that changes one must be a reviewed decision', () => {
    // Producto 24B stores amounts with these scales. A new ISO 4217 or CLDR release that
    // changes one fails here; changing this table needs a migration plan, never a rescale.
    const byExponent: Record<number, string[]> = {};
    for (const code of CURRENCY_CODES.filter(item => currencyRecord(item).kind === 'fiat')) (byExponent[minorUnitExponent(code)] ??= []).push(code);
    expect(byExponent[0]).toEqual(['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
    expect(byExponent[3]).toEqual(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);
    expect(byExponent[1]).toBeUndefined();
    expect(byExponent[4]).toBeUndefined();
    expect(Object.keys(byExponent).sort()).toEqual(['0', '2', '3']);
    // …and the set itself: a code ISO withdraws (HRK, SLL, ZWL before it) fails here too, because rows stored in it
    // would stop resolving. Keeping a withdrawn storable code as `historical` is part of Producto 24B.
    const FIAT = `AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BHD BIF BMD BND BOB BRL BSD BTN
      BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB
      EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR
      ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD
      MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR
      PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE
      SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU
      UZS VED VES VND VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW ZWG`.split(/\s+/);
    expect(CURRENCY_CODES.filter(code => currencyRecord(code).kind === 'fiat')).toEqual(FIAT);
  });

  it('validates codes without trusting their spelling', () => {
    expect(isIsoCurrencyCode('EUR')).toBe(true);
    for (const value of ['eur', 'EURO', '', 'toString', '__proto__', 'constructor', 42, null, undefined]) expect(isIsoCurrencyCode(value), String(value)).toBe(false);
    expect(() => currencyRecord('ABC' as IsoCurrencyCode)).toThrow('Moneda no admitida.');
    expect(() => currencyRecord('toString' as IsoCurrencyCode)).toThrow('Moneda no admitida.');
  });
});

describe('stored scale (the contract Producto 24B persists with)', () => {
  it('reads rows written before 24B as ARS and USD cents', () => {
    expect(storedExponent('ARS', undefined)).toBe(2);
    expect(storedExponent('USD', null)).toBe(2);
  });
  it('requires a scale for any other currency and never reinterprets a disagreeing one', () => {
    expect(storedExponent('JPY', 0)).toBe(0);
    expect(storedExponent('KWD', 3)).toBe(3);
    expect(() => storedExponent('JPY', undefined)).toThrow('La escala de la moneda no coincide con el registro.');
    expect(() => storedExponent('ARS', 3)).toThrow('La escala de la moneda no coincide con el registro.');
    expect(() => storedExponent('KWD', 2)).toThrow('La escala de la moneda no coincide con el registro.');
    expect(() => storedExponent('XAU', 0)).toThrow('Moneda no admitida.');
    // Only ARS and USD rows predate the scale; a scale-less EUR row (exponent 2 like cents) is damaged data.
    expect(() => storedExponent('EUR', undefined)).toThrow('La escala de la moneda no coincide con el registro.');
    expect(() => storedExponent('GBP', null)).toThrow('La escala de la moneda no coincide con el registro.');
    expect([...LEGACY_CURRENCIES]).toEqual(['ARS', 'USD']);
  });
});
