import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { draftFitsCurrency, draftRejectionMessage, formatMinorUnits, minorFromLedgerDraft, parseMinorUnits, type Currency } from '@finanzapp/domain';
import { AmountInput, LEDGER_FORMAT, amountFromMinor, currencyOfMark, displayAmount, draftFromMinor, precisionOf, readPastedAmount, settleAmount,
  type AmountFormat } from '../src/ui/money-input.ts';
import { prefillDraft } from '../src/ui/entry-prefill.ts';

// Producto 24B2, stage 3 of docs/currency.md §7.5: the amount path by exponent. Every helper that
// reads, writes or rebuilds an amount takes the currency; EUR (2), JPY (0) and KWD (3 decimals) are
// synthetic test fixtures (production offers ARS and USD only). For ARS and USD every output equals
// the two-decimal path byte for byte (money-input.node.ts keeps those goldens; the sweep below proves
// the new reader agrees with parseMinorUnits on every draft).
const AR: AmountFormat = { decimal: ',', group: '.' };
const US: AmountFormat = { decimal: '.', group: ',' };

/** The real controller driven like the iPhone does: one keystroke at the caret per `type`. */
function field(currency: Currency, format: AmountFormat = AR, draft = '') {
  const input = new AmountInput(draft, format, currency);
  const type = (keys: string) => { for (const key of keys) { const { text, caret } = input.view; input.change(text.slice(0, caret) + key + text.slice(caret), caret + 1); } return api; };
  const paste = (text: string) => { const { caret } = input.view; return input.change(input.view.text.slice(0, caret) + text + input.view.text.slice(caret), caret + text.length); };
  const backspace = () => { const { text, caret } = input.view; input.change(text.slice(0, caret - 1) + text.slice(caret), caret - 1); return api; };
  const api = { input, type, paste, backspace, get text() { return input.view.text; }, get draft() { return input.draft; }, settle: () => input.settle().draft };
  return api;
}

test('precision follows the ISO exponent: 15 significant digits in minor units for every currency', () => {
  assert.deepEqual(precisionOf('ARS'), { decimals: 2, wholeDigits: 13 });
  assert.deepEqual(precisionOf('USD'), { decimals: 2, wholeDigits: 13 });
  assert.deepEqual(precisionOf('EUR'), { decimals: 2, wholeDigits: 13 });
  assert.deepEqual(precisionOf('JPY'), { decimals: 0, wholeDigits: 15 });
  assert.deepEqual(precisionOf('KWD'), { decimals: 3, wholeDigits: 12 });
});

test('typing in yen: no decimal ever appears, fifteen whole digits at most; in dinars: three decimals, twelve whole digits', () => {
  const yen = field('JPY').type('1500,5');
  assert.deepEqual([yen.text, yen.draft], ['15.005', '15.005'], 'the comma is not a key in yen: the digits keep flowing as whole yen');
  assert.equal(field('JPY').type('999999999999999').text, '999.999.999.999.999');
  assert.equal(field('JPY').type('9999999999999999').text, '999.999.999.999.999', 'a sixteenth digit is refused');
  assert.equal(minorFromLedgerDraft(field('JPY').type('999999999999999').draft, 'JPY'), 999999999999999);
  const dinar = field('KWD').type('1234,5678');
  assert.deepEqual([dinar.text, dinar.draft], ['1.234,567', '1.234,567'], 'a fourth decimal does not appear');
  assert.equal(dinar.settle(), '1.234,567');
  assert.equal(field('KWD').type('1,2').settle(), '1,200', 'settling completes the dinar\'s three decimals');
  assert.equal(field('KWD').type('999999999999').text, '999.999.999.999');
  assert.equal(field('KWD').type('9999999999999').text, '999.999.999.999', 'a thirteenth whole digit is refused in dinars');
  assert.equal(field('EUR').type('12,5').settle(), '12,50');
  assert.equal(field('JPY', US).type('1500').text, '1,500', 'the region still gives the separators');
  assert.deepEqual(settleAmount({ negative: false, whole: '7', decimal: true, fraction: '', caret: 2 }, 'JPY'), { negative: false, whole: '7', decimal: false, fraction: '', caret: 1 });
});

test('pastes per exponent: nothing is guessed, nothing is rounded, no currency is converted', () => {
  const read = (text: string, currency: Currency, format = AR) => { const r = readPastedAmount(text, format, currency); return r.ok ? r.canonical : r.reason; };
  // Yen: whole numbers; a fraction that is not zeros is refused, never rounded.
  assert.equal(read('1.500', 'JPY'), '1500');
  assert.equal(read('1,500', 'JPY', US), '1500');
  assert.equal(read('12,5', 'JPY'), 'precision');
  assert.equal(read('12,00', 'JPY'), '12', 'trailing zeros are not a fraction');
  assert.equal(read('1,000', 'JPY'), 'ambiguous', 'not the region\'s group separator');
  assert.equal(read('JP¥ 500', 'JPY'), '500');
  assert.equal(read('JPY 500', 'JPY'), '500');
  assert.equal(read('$ 500', 'JPY'), '500', 'a bare $ is never evidence of a currency');
  assert.equal(read('US$ 500', 'JPY'), 'currencyMismatch');
  // Dinars: three decimals; one separator before three digits is ambiguous whatever the separator (1.234 dinars or a thousand).
  assert.equal(read('1.234,567', 'KWD'), '1234,567');
  assert.equal(read('1,234.567', 'KWD', US), '1234,567');
  assert.equal(read('1.234', 'KWD'), 'ambiguous');
  assert.equal(read('1,234', 'KWD', US), 'ambiguous');
  assert.equal(read('1.234.567', 'KWD'), '1234567', 'repeated separators group thousands');
  assert.equal(read('0,5', 'KWD'), '0,5');
  assert.equal(read('1,2345', 'KWD'), 'precision');
  assert.equal(read('1,2340', 'KWD'), '1,234');
  assert.equal(read('KWD 12,50', 'KWD'), '12,50');
  assert.equal(read('KWD 12,500', 'KWD'), 'ambiguous', 'the region\'s decimal separator before three digits is the other convention\'s thousands');
  assert.equal(read('€ 30', 'KWD'), 'currencyMismatch');
  assert.equal(read('9999999999999', 'KWD'), 'tooLong');
  // Euros: the two-decimal rules, and the catalogue symbol names the euro.
  assert.equal(read('€ 30', 'EUR'), '30');
  assert.equal(read('EUR 1.234,56', 'EUR'), '1234,56');
  assert.equal(read('US$ 30', 'EUR'), 'currencyMismatch');
  assert.equal(read('€ 30', 'USD'), 'currencyMismatch');
  assert.equal(read('30 CHF', 'EUR'), 'currencyMismatch', 'any catalogue code is evidence');
  assert.equal(read('R$ 30', 'EUR'), 'currencyMismatch', 'any unique catalogue symbol is evidence (R$ is the real)');
  assert.equal(read('1.000', 'EUR'), '1000');
  assert.equal(read('1,000', 'EUR'), 'ambiguous');
  // Marks resolve through the catalogue; the two FinanzApp conventions stay.
  assert.deepEqual(['US$', 'AR$', 'U$S', 'EUR', 'eur', '€', 'JP¥', 'KWD', 'CA$', '$', 'XAU', 'ZZZ'].map(currencyOfMark),
    ['USD', 'ARS', 'USD', 'EUR', 'EUR', 'EUR', 'JPY', 'KWD', 'CAD', null, null, null]);
  // In a field, a refused paste leaves the digits exactly as they were.
  const dinar = field('KWD').type('25');
  const result = dinar.paste('1.234');
  assert.deepEqual([result.rejected?.reason, dinar.text, dinar.draft], ['ambiguous', '25', '25']);
});

test('prefills and shortcuts write minor units in their currency\'s own decimals; a wrong currency would move the mark', () => {
  assert.equal(draftFromMinor(123456, 'ARS'), '1.234,56');
  assert.equal(draftFromMinor(123456, 'EUR'), '1.234,56');
  assert.equal(draftFromMinor(123456, 'JPY'), '123.456');
  assert.equal(draftFromMinor(123456, 'KWD'), '123,456');
  assert.equal(draftFromMinor(1500, 'JPY'), '1.500');
  assert.equal(draftFromMinor(5, 'KWD'), '0,005');
  assert.equal(draftFromMinor(-1234567, 'KWD'), '-1.234,567');
  assert.equal(draftFromMinor(0, 'JPY'), '0');
  assert.equal(draftFromMinor(0, 'KWD'), '0,000');
  assert.equal(draftFromMinor(Number.MAX_SAFE_INTEGER + 2, 'JPY'), '');
  assert.equal(amountFromMinor(1500, 'JPY'), '1.500');
  assert.equal(amountFromMinor(1234500, 'KWD'), '1.234,500');
  assert.equal(amountFromMinor(1234000, 'KWD'), '1.234', 'whole dinars stay whole');
  assert.equal(amountFromMinor(5, 'KWD'), '0,005');
  assert.equal(amountFromMinor(0, 'KWD'), '');
  assert.equal(amountFromMinor(-5, 'JPY'), '');
  for (const [minor, currency] of [[1500, 'JPY'], [1234567, 'KWD'], [5, 'KWD'], [123456, 'EUR'], [999999999999999, 'JPY'], [999999999999999, 'KWD']] as [number, Currency][]) {
    assert.equal(minorFromLedgerDraft(draftFromMinor(minor, currency), currency), minor, `${currency} ${minor} round-trips through the prefill`);
    assert.equal(minorFromLedgerDraft(amountFromMinor(minor, currency), currency), minor, `${currency} ${minor} round-trips through the shortcut`);
    assert.equal(displayAmount(draftFromMinor(minor, currency), US, currency), displayAmount(draftFromMinor(minor, currency), AR, currency).replace(/\./g, '#').replace(/,/g, '.').replace(/#/g, ','));
  }
  // The Assistant hand-off: minor units with their currency; the older two-decimal draft string still reads.
  assert.equal(prefillDraft({ amountMinor: '1500', currency: 'JPY' }), '1.500');
  assert.equal(prefillDraft({ amountMinor: '1850000', currency: 'ARS' }), '18.500,00', 'exactly the two-decimal prefill of before');
  assert.equal(prefillDraft({ amountMinor: '1850000', currency: 'ARS', amount: '99' }), '18.500,00', 'minor units win over the old string');
  assert.equal(prefillDraft({ amount: '18.500,00' }), '18.500,00');
  assert.equal(prefillDraft({ amountMinor: '1500', currency: 'XAU', amount: '15' }), '15', 'a currency that cannot hold amounts falls back to the old string');
  assert.equal(prefillDraft({ amountMinor: '15.00', currency: 'ARS' }), '', 'minor units are digits only');
  assert.equal(prefillDraft(undefined), '');
});

test('the ledger-draft reader agrees with parseMinorUnits for ARS and USD on every draft, and speaks each currency\'s decimals', () => {
  // '10.000.000.000.000' (14 whole digits) is left out on purpose: parseMinorUnits accepted any safe integer, the field never produced more
  // than 13 whole digits, and the domain's entry bound (docs/currency.md §5) now refuses it explicitly ("El monto es demasiado grande.").
  const drafts = ['', '0', '0,01', '1.234,56', '1234,56', '1234,5', '10.000', '-1.234,56', ' 125 ', '0,29', 'mil', '12abc', '1.23.4', '1,234,56', '12,3456',
    '-0,001', 'Infinity', '1e3', '$120', '999999999999999999999999999', '9.999.999.999.999,99', '12,', ',5', '-', '00,70'];
  for (const draft of drafts) {
    for (const currency of ['ARS', 'USD'] as Currency[]) {
      let legacy: string | number, current: string | number;
      try { legacy = parseMinorUnits(draft); } catch (error) { legacy = 'threw ' + (error as Error).message; }
      try { current = minorFromLedgerDraft(draft, currency); } catch (error) { current = 'threw ' + (error as Error).message; }
      assert.equal(current, legacy, `${currency} "${draft}"`);
    }
  }
  assert.throws(() => minorFromLedgerDraft('12,', 'ARS'), /dos decimales/, 'a dangling comma is settled by the field on blur, and refused here like before');
  // parseMinorUnits also read US separators ("1,234.56"): a form draft is always ledger notation, so the new reader does not guess.
  assert.equal(parseMinorUnits('1,234.56'), 123456);
  assert.throws(() => minorFromLedgerDraft('1,234.56', 'ARS'), /dos decimales/);
  assert.throws(() => minorFromLedgerDraft('10.000.000.000.000', 'ARS'), /demasiado grande/, 'beyond the entry bound, even though it is a safe integer');
  // The one deliberate difference (docs/currency.md §5): zeros beyond the currency's decimals are not a fraction, so "1.000,000" reads as a
  // thousand where parseMinorUnits refused it; the field never produces a third decimal in pesos, so no ARS/USD draft changes meaning.
  assert.equal(minorFromLedgerDraft('1.000,000', 'ARS'), 100000);
  assert.throws(() => parseMinorUnits('1.000,000'), /dos decimales/);
  for (const minor of [0, 1, 5, 100, 123456, -123456, 999999999999999]) assert.equal(draftFromMinor(minor, 'ARS'), formatMinorUnits(minor));
  assert.throws(() => minorFromLedgerDraft('12,5', 'JPY'), /Usá números enteros: esta moneda no tiene decimales\./);
  assert.throws(() => minorFromLedgerDraft('1,2345', 'KWD'), /Usá números con hasta 3 decimales\./);
  assert.throws(() => minorFromLedgerDraft('1,234', 'EUR'), /Usá números con hasta dos decimales\./);
  assert.throws(() => minorFromLedgerDraft('', 'KWD'), /Ingresá un monto válido\./);
  assert.throws(() => minorFromLedgerDraft('9999999999999', 'KWD'), /El monto es demasiado grande\./);
  assert.equal(draftRejectionMessage('precision', 'BHD'), 'Usá números con hasta 3 decimales.');
  assert.equal(minorFromLedgerDraft('1.500', 'JPY'), 1500);
  assert.equal(minorFromLedgerDraft('1.234,567', 'KWD'), 1234567);
  assert.equal(minorFromLedgerDraft('1.500,000', 'JPY'), 1500, 'zeros beyond the exponent are not a fraction');
});

test('a draft kept across a currency change is never truncated or rescaled: the field keeps the digits and the form cannot save it', () => {
  const pesos = field('ARS').type('12,50');
  const before = { text: pesos.text, draft: pesos.draft, caret: pesos.input.view.caret };
  pesos.input.retarget('USD');
  assert.deepEqual({ text: pesos.text, draft: pesos.draft, caret: pesos.input.view.caret }, before, 'ARS ↔ USD changes nothing');
  assert.deepEqual(draftFitsCurrency(pesos.draft, 'USD'), { ok: true });
  pesos.input.retarget('JPY');
  assert.deepEqual({ text: pesos.text, draft: pesos.draft, caret: pesos.input.view.caret }, before, 'the digits stay exactly as typed');
  assert.deepEqual(draftFitsCurrency(pesos.draft, 'JPY'), { ok: false, reason: 'precision' });
  assert.throws(() => minorFromLedgerDraft(pesos.draft, 'JPY'), /números enteros/);
  pesos.type('7');
  assert.equal(pesos.text, '12,50', 'the fraction cannot grow, and nothing is cut');
  assert.equal(pesos.settle(), '12,50', 'settling in yen leaves a kept fraction alone');
  pesos.backspace(); pesos.backspace(); pesos.backspace();
  assert.deepEqual([pesos.text, draftFitsCurrency(pesos.draft, 'JPY').ok], ['12', true], 'once the person removes the decimals it fits');
  const dinar = field('KWD').type('1,234');
  dinar.input.retarget('ARS');
  assert.deepEqual([dinar.text, draftFitsCurrency(dinar.draft, 'ARS')], ['1,234', { ok: false, reason: 'precision' }]);
  const wide = field('JPY').type('99999999999999');
  wide.input.retarget('KWD');
  assert.deepEqual([wide.text, draftFitsCurrency(wide.draft, 'KWD')], ['99.999.999.999.999', { ok: false, reason: 'tooLong' }]);
  // Mounting a field with a draft that does not fit shows it whole, in the region's separators.
  assert.equal(displayAmount('12,50', US, 'JPY'), '12.50');
  assert.equal(new AmountInput('12,50', AR, 'JPY').view.text, '12,50');
  assert.equal(new AmountInput('12,50', AR, 'JPY').draft, '12,50');
  assert.deepEqual(draftFitsCurrency('', 'JPY'), { ok: true });
  assert.deepEqual(draftFitsCurrency('12abc', 'JPY'), { ok: true }, 'text that is not an amount is the save path\'s refusal, not a kept-draft notice');
});

test('the module assumes no exponent: no power of ten, no two-decimal constant, no cents slice', () => {
  const source = readFileSync(new URL('../src/ui/money-input.ts', import.meta.url), 'utf8');
  assert.equal(/10 ?\*\*|MAX_DECIMALS|MAX_WHOLE_DIGITS|padStart\(3|slice\(-2\)|\/ ?100|\* ?100/.test(source), false);
  assert.deepEqual(LEDGER_FORMAT, AR);
});
