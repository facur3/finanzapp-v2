import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { formatMinorUnits, parseMinorUnits } from '@finanzapp/domain';
import { AmountInput, EMPTY_AMOUNT, LEDGER_FORMAT, amountFromCanonical, amountFromDraft, amountFromMinor, canonicalAmount, displayAmount, displayCaret,
  draftFromMinor, logicalCaret, readPastedAmount, reformatAmount, renderAmount, settleAmount, splitAmount, type AmountFormat, type AmountNotice } from '../src/ui/money-input.ts';

// The amount field keeps a canonical edit state (sign, whole digits, decimal
// mark, fraction, logical caret) and derives the display string and display
// caret from it and the region's separators. These tests drive the real
// controller (AmountInput, what AmountField forwards native events to) the way
// the iPhone does: each keystroke edits the native display text at the caret,
// and the native text and caret come back through `change`. Presentation
// only: the draft the form receives is in the ledger's notation and parses to
// integer minor units with parseMinorUnits, in every region.

const AR: AmountFormat = { decimal: ',', group: '.' };
const US: AmountFormat = { decimal: '.', group: ',' };

/** A simulated native field over the real controller: the text and caret iOS holds, plus what the form received. */
class Field {
  input: AmountInput;
  /** The text the native view actually has; it lags the render when `lag` is set. */
  native = { text: '', caret: 0 };
  /** The last draft handed to the form (onChangeText). */
  draft: string;
  notice: AmountNotice | null = null;
  private lag: boolean;
  private expectedCurrency?: 'ARS' | 'USD';
  constructor(lag = false, format: AmountFormat = AR, draft = '', expectedCurrency?: 'ARS' | 'USD') {
    this.lag = lag;
    this.expectedCurrency = expectedCurrency;
    this.input = new AmountInput(draft, format);
    this.draft = draft;
    this.native = { ...this.input.view };
  }
  private apply(raw: string, rawCaret: number) {
    const result = this.input.change(raw, rawCaret, this.expectedCurrency);
    this.draft = result.draft;
    this.notice = result.rejected;
    this.native = this.lag ? { text: raw, caret: rawCaret } : { ...result.view };
  }
  /** Lets a lagging native view catch up with the last render (the controlled update landing). */
  sync() { this.native = { ...this.input.view }; return this; }
  type(char: string) {
    const { text, caret } = this.native;
    this.apply(text.slice(0, caret) + char + text.slice(caret), caret + 1);
    return this;
  }
  typeAll(keys: string) { for (const key of keys) this.type(key); return this; }
  backspace() {
    const { text, caret } = this.native;
    if (caret === 0) return this;
    this.apply(text.slice(0, caret - 1) + text.slice(caret), caret - 1);
    return this;
  }
  /** Tap: move the caret to a display index (the native selection event). */
  tap(index: number) {
    this.native.caret = index;
    this.input.select(index, this.native.text);
    return this;
  }
  /** Replace a selected display range with text (typing over a selection, or a paste). */
  replace(start: number, end: number, insert: string) {
    const { text } = this.native;
    this.apply(text.slice(0, start) + insert + text.slice(end), start + insert.length);
    return this;
  }
  paste(insert: string) { return this.replace(this.native.caret, this.native.caret, insert); }
  /** The region changed with the form open. */
  region(format: AmountFormat) { this.input.reformat(format); this.native = { ...this.input.view }; return this; }
  settle() { this.draft = this.input.settle().draft; this.native = { ...this.input.view }; return this; }
  get text() { return this.input.view.text; }
  get caret() { return this.input.view.caret; }
  get canonical() { return canonicalAmount(this.input.state); }
  get logical() { return this.input.state.caret; }
  get minor() { return parseMinorUnits(this.draft); }
}

/** The display text of a canonical string in a format ("1234,5" → "1,234.5" in the US). */
const shown = (canonical: string, format: AmountFormat) => renderAmount(amountFromCanonical(canonical)!, format).text;

type Step = [key: string, canonical: string, display: string, logical: number, displayCaret: number];

test('sequential typing: 3 → 3.000.000 groups as the digits arrive, with the caret after the same logical digit', () => {
  const field = new Field();
  const steps: Step[] = [
    ['3', '3', '3', 1, 1], ['0', '30', '30', 2, 2], ['0', '300', '300', 3, 3],
    ['0', '3000', '3.000', 4, 5], ['0', '30000', '30.000', 5, 6], ['0', '300000', '300.000', 6, 7],
    ['0', '3000000', '3.000.000', 7, 9],
  ];
  for (const [key, canonical, display, logical, caret] of steps) {
    field.type(key);
    assert.equal(field.canonical, canonical, 'after ' + key);
    assert.equal(field.text, display);
    assert.equal(field.logical, logical);
    assert.equal(field.caret, caret);
    assert.equal(parseMinorUnits(field.text), Number(canonical) * 100);
  }
  field.type(',');
  assert.deepEqual([field.canonical, field.text, field.logical, field.caret], ['3000000,', '3.000.000,', 8, 10]);
  field.type('5');
  assert.deepEqual([field.canonical, field.text, field.logical, field.caret], ['3000000,5', '3.000.000,5', 9, 11]);
  field.type('0');
  assert.deepEqual([field.canonical, field.text, field.logical, field.caret], ['3000000,50', '3.000.000,50', 10, 12]);
  assert.equal(parseMinorUnits(field.text), 300000050);
  field.type('7');
  assert.equal(field.text, '3.000.000,50', 'a third decimal is refused and the field is unchanged');
  assert.equal(field.caret, 12);
});

test('repeated zeroes, typed faster than the controlled update lands, never turn a grouping dot into a decimal', () => {
  // The native view still shows the pre-format text when the next key arrives (the device failure).
  const field = new Field(true);
  const expected = ['3', '30', '300', '3.000', '30.000', '300.000', '3.000.000', '30.000.000', '300.000.000'];
  field.type('3');
  for (let index = 1; index < expected.length; index++) {
    field.type('0');
    assert.equal(field.text, expected[index], `${index} zeroes`);
    assert.equal(field.canonical, '3' + '0'.repeat(index));
    assert.equal(field.logical, index + 1);
    assert.equal(field.caret, field.text.length);
    assert.equal(field.text.includes(','), false, 'no decimal ever appears from our own dots');
  }
  field.sync().type('0');
  assert.equal(field.text, '3.000.000.000');
  // Backspace while lagging: digits are still the truth.
  field.backspace();
  assert.equal(field.text, '300.000.000');
  assert.equal(field.canonical, '300000000');
});

test('a lagging native view that still holds a stale dot does not lose a typed comma or digit', () => {
  const field = new Field(true);
  for (const key of '3000') field.type(key);
  assert.equal(field.text, '3.000');
  field.type('0'); // native "30000" (stale, unformatted) → still 30.000
  assert.equal(field.text, '30.000');
  field.type(','); // typed on the stale native text
  assert.deepEqual([field.canonical, field.text], ['30000,', '30.000,']);
  field.type('5');
  assert.deepEqual([field.canonical, field.text], ['30000,5', '30.000,5']);
});

test('backspace at the end walks back through the groups', () => {
  const field = new Field();
  for (const key of '3000000') field.type(key);
  const expected = ['300.000', '30.000', '3.000', '300', '30', '3', ''];
  for (const display of expected) {
    field.backspace();
    assert.equal(field.text, display);
    assert.equal(field.caret, display.length);
    assert.equal(field.logical, field.canonical.length);
  }
  field.backspace();
  assert.equal(field.text, '', 'backspace on an empty field stays empty');
});

test('backspace immediately after a grouping dot removes the digit before the dot; before a dot it removes the digit', () => {
  const field = new Field();
  for (const key of '3456789') field.type(key); // 3.456.789
  field.tap(2); // "3.|456.789": caret right after the first dot
  field.backspace();
  assert.deepEqual([field.canonical, field.text, field.logical, field.caret], ['456789', '456.789', 0, 0], 'the 3 before the dot goes');
  const again = new Field();
  for (const key of '3456789') again.type(key);
  again.tap(1); // "3|.456.789": caret right before the first dot
  again.backspace();
  assert.deepEqual([again.canonical, again.text, again.logical, again.caret], ['456789', '456.789', 0, 0]);
  const middle = new Field();
  for (const key of '3456789') middle.type(key);
  middle.tap(6); // "3.456|.789"
  middle.backspace();
  assert.deepEqual([middle.canonical, middle.text, middle.logical, middle.caret], ['345789', '345.789', 3, 3], 'the 6 goes; the caret stays after the 5');
  middle.backspace();
  assert.deepEqual([middle.canonical, middle.text, middle.logical, middle.caret], ['34789', '34.789', 2, 2]);
});

test('tapping into the middle and inserting keeps the caret after the inserted digit while the grouping moves around it', () => {
  const field = new Field();
  for (const key of '1234567') field.type(key); // 1.234.567
  field.tap(3); // "1.2|34.567"
  field.type('9');
  assert.deepEqual([field.canonical, field.text, field.logical, field.caret], ['12934567', '12.934.567', 3, 4]);
  field.type('9');
  assert.deepEqual([field.canonical, field.text, field.logical, field.caret], ['129934567', '129.934.567', 4, 5]);
  field.tap(0);
  field.type('5');
  assert.deepEqual([field.canonical, field.text, field.logical, field.caret], ['5129934567', '5.129.934.567', 1, 1], 'a caret before a new dot stays before it');
  field.type('0');
  assert.deepEqual([field.text, field.caret], ['50.129.934.567', 2]);
});

test('editing in the middle of 1.234.567,89 never confuses grouping dots with the decimal comma', () => {
  const field = new Field();
  for (const key of '1234567,89') field.type(key);
  assert.equal(field.text, '1.234.567,89');
  field.tap(5); // "1.234|.567,89"
  field.type('0');
  assert.deepEqual([field.canonical, field.text, field.logical, field.caret], ['12340567,89', '12.340.567,89', 5, 6]);
  field.tap(11); // "12.340.567,|89"
  field.backspace(); // removes the comma: the digits merge
  assert.deepEqual([field.canonical, field.text], ['1234056789', '1.234.056.789']);
  field.tap(13);
  field.type(',');
  assert.deepEqual([field.canonical, field.text, field.caret], ['1234056789,', '1.234.056.789,', 14]);
  field.tap(9); // "1.234.056|.789,"
  field.type(',');
  assert.equal(field.text, '1.234.056.789,', 'a second comma is ignored and the field stays as it was');
});

test('selection replacement: typing over a selected range across dots', () => {
  const field = new Field();
  for (const key of '1234567') field.type(key); // 1.234.567
  field.replace(2, 7, '9'); // select "234.5", type 9 → "1.967"
  assert.deepEqual([field.canonical, field.text, field.logical, field.caret], ['1967', '1.967', 2, 3]);
  field.replace(0, 5, '');
  assert.deepEqual([field.canonical, field.text, field.caret], ['', '', 0], 'select all and delete');
  field.paste('42');
  assert.deepEqual([field.text, field.caret], ['42', 2]);
  field.replace(0, 2, '7');
  assert.deepEqual([field.text, field.caret], ['7', 1], 'select all and type');
});

test('the decimal comma is the explicit separator: two decimals at most, a leading comma shows its zero', () => {
  const field = new Field();
  for (const key of ',5') field.type(key);
  assert.deepEqual([field.canonical, field.text, field.caret], ['0,5', '0,5', 3]);
  const zero = new Field();
  zero.type(',');
  assert.deepEqual([zero.canonical, zero.text, zero.caret], ['0,', '0,', 2]);
  zero.type('0').type('7');
  assert.deepEqual([zero.text, zero.caret], ['0,07', 4]);
  zero.type('1');
  assert.equal(zero.text, '0,07');
  const lead = new Field();
  for (const key of '0007') lead.type(key);
  assert.deepEqual([lead.text, lead.caret], ['7', 1], 'leading zeros vanish and the caret follows');
  for (const key of ',70') lead.type(key);
  assert.equal(lead.text, '7,70');
});

test('a typed period (en-US keypad or hardware keyboard) is explicit input and becomes the decimal comma', () => {
  const field = new Field();
  for (const key of '2000.5') field.type(key);
  assert.deepEqual([field.canonical, field.text, field.caret], ['2000,5', '2.000,5', 7]);
  const rest = new Field();
  for (const key of '12345.') rest.type(key);
  assert.deepEqual([rest.text, rest.caret], ['12.345,', 7], 'the caret can rest after the separator');
  rest.type('.');
  assert.equal(rest.text, '12.345,', 'a second period is ignored');
  const middle = new Field();
  for (const key of '1234567') middle.type(key);
  middle.tap(5).type('.'); // "1.234|.567" then a period: decimal after 1234
  assert.deepEqual([middle.canonical, middle.text, middle.caret], ['1234,56', '1.234,56', 6], 'the digits after become the (two) decimals');
});

test('pasting Argentine and US formatted numbers normalises by the separators the text itself uses, when they say it unambiguously', () => {
  const cases: [string, string, string][] = [
    ['2.000.000,50', '2000000,50', '2.000.000,50'], ['2,000,000.50', '2000000,50', '2.000.000,50'],
    ['2000000.5', '2000000,5', '2.000.000,5'], ['2000000', '2000000', '2.000.000'], ['1.000', '1000', '1.000'],
    ['$ 1.234,56', '1234,56', '1.234,56'], ['US$ 12.30', '12,30', '12,30'], ['ARS 1.234,56', '1234,56', '1.234,56'],
    ['-500', '-500', '-500'], ['0007', '7', '7'], ['00,70', '0,70', '0,70'], ['1 234,56', '1234,56', '1.234,56'], ['0,500', '0,50', '0,50'],
  ];
  for (const [pasted, canonical, display] of cases) {
    const field = new Field().paste(pasted);
    assert.equal(field.canonical, canonical, pasted);
    assert.equal(field.text, display, pasted);
    assert.equal(field.caret, display.length, pasted + ': the caret lands after the paste');
    assert.equal(field.notice, null, pasted);
  }
  const into = new Field().typeAll('99');
  into.tap(1).paste('1.000,5');
  assert.deepEqual([into.canonical, into.text, into.caret], ['91000,59', '91.000,59', 8], 'a paste in the middle keeps its own decimals; the digit after it becomes a decimal');
});


test('a pasted explicit currency must match the account; no implicit FX conversion', () => {
  const cases: [string, AmountFormat, 'ARS' | 'USD', string | null][] = [
    ['US$ 12.30', AR, 'ARS', null],
    ['USD 12.30', US, 'ARS', null],
    ['U$S 100', AR, 'ARS', null],
    ['AR$ 1,234.56', US, 'USD', null],
    ['ARS 1.234,56', AR, 'USD', null],
    ['US$ 12.30', AR, 'USD', '12,30'],
    ['USD 12.30', US, 'USD', '12,30'],
    ['U$S 100', AR, 'USD', '100'],
    ['AR$ 1,234.56', US, 'ARS', '1.234,56'],
    ['ARS 1.234,56', AR, 'ARS', '1.234,56'],
    ['$ 50', AR, 'USD', '50'], // Bare $ is not unambiguous currency evidence.
    ['50', US, 'ARS', '50'],
  ];
  for (const [paste, format, accountCurrency, canonical] of cases) {
    const field = new Field(false, format, '', accountCurrency).typeAll('25');
    const previous = field.draft;
    field.replace(0, field.native.text.length, paste);
    if (canonical === null) {
      assert.equal(field.notice?.reason, 'currencyMismatch', paste + ' on ' + accountCurrency);
      assert.equal(field.draft, previous, 'currency mismatch leaves the ledger draft untouched');
      assert.equal(field.text, '25', 'currency mismatch leaves the visible number untouched');
    } else {
      assert.equal(field.notice, null, paste);
      assert.equal(field.draft, canonical, paste + ' on ' + accountCurrency);
    }
  }
  assert.deepEqual(readPastedAmount('USD ARS 100', AR, 'USD'), { ok: false, reason: 'invalid' }, 'multiple explicit currency markers are invalid');
});

test('a paste that could mean two amounts, or none, is refused with a reason and the field keeps its value', () => {
  const refused: [string, AmountFormat, AmountNotice['reason']][] = [
    ['1,000', AR, 'ambiguous'], ['12,345', AR, 'ambiguous'], ['1.000', US, 'ambiguous'], ['999.999', US, 'ambiguous'],
    ['1.000.5', AR, 'invalid'], ['1,2,3', US, 'invalid'], ['abc', AR, 'invalid'], ['12 34', AR, 'invalid'], ['2 cafés a 1.500', AR, 'invalid'],
    ['1..5', AR, 'invalid'], ['1.234,567', AR, 'precision'], ['1234,567', AR, 'precision'],
    ['12345678901234', AR, 'tooLong'], ['1,234.567', US, 'precision'],
  ];
  for (const [pasted, format, reason] of refused) {
    const field = new Field(false, format).typeAll('42');
    const before = [field.text, field.draft, field.caret];
    field.paste(pasted);
    assert.deepEqual(field.notice, { reason, text: pasted.trim() }, pasted + ' in ' + format.decimal);
    assert.deepEqual([field.text, field.draft, field.caret], before, pasted + ': the field is exactly as it was');
  }
  // The region's own convention is unambiguous for its reader.
  assert.equal(new Field(false, AR).paste('12.345').text, '12.345');
  assert.equal(new Field(false, US).paste('12,345').text, '12,345');
  assert.equal(new Field(false, US).paste('12,345').minor, 1234500);
  // Both separators, or a separator before one or two digits, mean the same thing in every region.
  for (const format of [AR, US]) {
    assert.equal(new Field(false, format).paste('1.234,56').minor, 123456);
    assert.equal(new Field(false, format).paste('1,234.56').minor, 123456);
    assert.equal(new Field(false, format).paste('1,5').minor, 150);
    assert.equal(new Field(false, format).paste('1.5').minor, 150);
    assert.equal(new Field(false, format).paste('1.234.567').minor, 123456700, 'a repeated separator can only group');
    assert.equal(new Field(false, format).paste('1,234,567').minor, 123456700);
  }
  // A paste that would give the field a second decimal separator, a third decimal or a second sign.
  const decimals = new Field().typeAll('5,5');
  decimals.paste('1,25');
  assert.equal(decimals.notice?.reason, 'invalid');
  assert.equal(decimals.text, '5,5');
  const third = new Field().typeAll('5,');
  third.paste('123');
  assert.equal(third.text, '5,12', 'digits alone are typing: a third decimal simply does not appear');
  const sign = new Field().typeAll('12');
  sign.paste('-5,5');
  assert.equal(sign.notice?.reason, 'invalid', 'a minus inside a number is not a sign');
  // A successful edit clears the note.
  const recover = new Field().paste('1,000');
  assert.equal(recover.notice?.reason, 'ambiguous');
  recover.type('7');
  assert.equal(recover.notice, null);
  assert.equal(recover.text, '7');
});

test('the paste reader keeps digits only: no number is computed from the text, and every accepted paste parses to the same minor units', () => {
  const accepted: [string, AmountFormat, number][] = [
    ['1.234,56', AR, 123456], ['1,234.56', US, 123456], ['$1,234.56', US, 123456], ['AR$ 1.234,56', US, 123456], ['U$S 100', AR, 10000],
    ['−1.000', AR, -100000], ['- $ 5', AR, -500], ['9.999.999.999.999,99', AR, 999999999999999], ['0,05', US, 5], ['.5', US, 50], [',5', AR, 50],
  ];
  for (const [text, format, minor] of accepted) {
    const read = readPastedAmount(text, format);
    assert.ok(read.ok, text);
    if (read.ok) assert.equal(parseMinorUnits(displayAmount(read.canonical.replace(/^-/, ''))) * (read.negative ? -1 : 1), minor, text);
  }
});

test('limits: thirteen whole digits and two decimals; a refused edit leaves the field exactly as it was', () => {
  const field = new Field();
  for (const key of '9999999999999') field.type(key);
  assert.equal(field.text, '9.999.999.999.999');
  field.type('9');
  assert.deepEqual([field.text, field.caret], ['9.999.999.999.999', 17], 'a fourteenth digit is refused');
  for (const key of ',99') field.type(key);
  assert.equal(field.text, '9.999.999.999.999,99');
  assert.ok(parseMinorUnits(field.text) <= Number.MAX_SAFE_INTEGER);
  field.tap(0).type('1');
  assert.equal(field.text, '9.999.999.999.999,99', 'refused in the middle too');
  assert.equal(field.caret, 0, 'and the caret stays where it was');
});

test('a negative recorded balance keeps its sign through every edit', () => {
  assert.equal(formatMinorUnits(-123456), '-1.234,56');
  assert.equal(displayAmount('-1.234,56'), '-1.234,56', 'a prefilled negative balance renders unchanged');
  const field = new Field();
  field.paste('-1.234,56');
  assert.deepEqual([field.canonical, field.text, field.caret], ['-1234,56', '-1.234,56', 9]);
  field.backspace();
  assert.deepEqual([field.canonical, field.text], ['-1234,5', '-1.234,5'], 'editing the cents never drops the sign');
  field.tap(1).type('2');
  assert.deepEqual([field.text, field.caret], ['-21.234,5', 2]);
  field.replace(0, 1, '');
  assert.equal(field.text, '21.234,5', 'deleting the minus makes it positive');
  const minus = new Field().type('-');
  assert.deepEqual([minus.text, minus.caret], ['-', 1], 'a minus can be typed first');
  for (const key of '500') minus.type(key);
  assert.equal(minus.text, '-500');
  assert.equal(new Field().paste('−1.000').text, '-1.000', 'the typographic minus is normalised');
  assert.equal(parseMinorUnits(field.text), 2123450);
});

test('settling on blur drops a dangling comma or sign and completes the decimals without touching the value', () => {
  const settle = (text: string) => renderAmount(settleAmount(amountFromCanonical(text.replace(/\./g, ''))!)).text;
  assert.equal(settle('2.000,'), '2.000');
  assert.equal(settle('2.000,5'), '2.000,50');
  assert.equal(settle('2.000'), '2.000', 'a whole amount does not grow ,00');
  assert.equal(settle(''), '');
  assert.equal(settle('0,'), '0');
  assert.equal(settle('-'), '');
  assert.equal(settle('-1.234,5'), '-1.234,50');
  assert.equal(parseMinorUnits(settle('2.000,5')), parseMinorUnits('2.000,5'));
});

test('the display string round-trips through the domain parser to exact minor units; presentation never changes the value', () => {
  const cases: [string, number][] = [
    ['2', 200], ['20', 2000], ['200', 20000], ['2.000', 200000], ['20.000', 2000000], ['200.000', 20000000],
    ['2.000.000', 200000000], ['2.000.000,50', 200000050], ['0,5', 50], ['0,05', 5], ['1.234.567,89', 123456789],
  ];
  for (const [display, minor] of cases) {
    assert.equal(parseMinorUnits(display), minor, display);
    assert.equal(displayAmount(display), display, 'the display form is a fixed point');
    assert.equal(displayAmount(formatMinorUnits(minor)), formatMinorUnits(minor), 'a stored amount renders unchanged');
    assert.equal(parseMinorUnits(displayAmount(formatMinorUnits(minor))), minor);
  }
  const period = new Field(), comma = new Field();
  for (const key of '1234567.89') period.type(key);
  for (const key of '1234567,89') comma.type(key);
  assert.equal(period.text, comma.text);
  assert.equal(parseMinorUnits(period.text), 123456789);
  for (const currency of ['ARS', 'USD']) assert.equal(period.text, '1.234.567,89', currency + ' shares the Argentine grouping');
});

test('display caret mapping: grouping dots never move the logical position', () => {
  const state = amountFromCanonical('3000000,50')!;
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(logical => displayCaret(state, logical)), [0, 1, 3, 4, 5, 7, 8, 9, 10, 11, 12]);
  assert.equal(displayCaret(state, 99), 12, 'clamped to the end');
  for (let index = 0; index <= '3.000.000,50'.length; index++) {
    const logical = logicalCaret('3.000.000,50', index);
    assert.ok(displayCaret(state, logical) === index || '3.000.000,50'[index - 1] === '.', 'display → logical → display returns to the same place, except a caret after a dot, which sits before it');
  }
  const negative = amountFromCanonical('-1234567')!;
  assert.equal(displayCaret(negative, 1), 1);
  assert.equal(displayCaret(negative, 8), 10);
  assert.equal(renderAmount(negative).text, '-1.234.567');
});

test('the module never converts the amount to a floating-point number', () => {
  const source = readFileSync(new URL('../src/ui/money-input.ts', import.meta.url), 'utf8');
  assert.equal(/parseFloat|Number\(|toFixed|\* ?100|\/ ?100/.test(source), false, 'string arithmetic only');
});

test('hero amounts split into symbol, whole units and decimals for a colour hierarchy, never a second value', () => {
  assert.deepEqual(splitAmount('$ 2.000.000,00'), { prefix: '$ ', whole: '2.000.000', decimals: ',00' });
  assert.deepEqual(splitAmount('−US$ 1.234,56'), { prefix: '−US$ ', whole: '1.234', decimals: ',56' });
  assert.deepEqual(splitAmount('+$ 0,05'), { prefix: '+$ ', whole: '0', decimals: ',05' });
  assert.deepEqual(splitAmount('$ 12'), { prefix: '$ ', whole: '12', decimals: '' });
  const { prefix, whole, decimals } = splitAmount('−US$ 999.999.999,99');
  assert.equal(prefix + whole + decimals, '−US$ 999.999.999,99', 'the parts concatenate to the original string');
});

test('a shortcut fills the field as the person would have typed the amount, from integer minor units', () => {
  assert.equal(amountFromMinor(19016200), '190.162');
  assert.equal(amountFromMinor(19016250), '190.162,50');
  assert.equal(amountFromMinor(5), '0,05');
  assert.equal(amountFromMinor(100), '1');
  assert.equal(amountFromMinor(999999999999999), '9.999.999.999.999,99');
  for (const minor of [19016200, 19016250, 5, 100, 1310, 999999999999999]) assert.equal(parseMinorUnits(amountFromMinor(minor)), minor, 'round trip ' + minor);
  // Never a negative, zero or fabricated "all".
  assert.equal(amountFromMinor(0), '');
  assert.equal(amountFromMinor(-19016200), '');
  assert.equal(amountFromMinor(Number.MAX_SAFE_INTEGER + 2), '');
  assert.equal(amountFromMinor(12.5), '');
});

// ---- Producto 23.1C1: the region's separators ------------------------------

test('999 → 1.000 and 999.999 → 1.000.000 in Argentina, 999 → 1,000 and 999,999 → 1,000,000 in the United States: the caret stays after the typed digit', () => {
  for (const [format, thousand, million] of [[AR, '1.000', '1.000.000'], [US, '1,000', '1,000,000']] as const) {
    const field = new Field(false, format).typeAll('999');
    assert.deepEqual([field.text, field.caret], ['999', 3]);
    field.replace(0, 3, '1000');
    assert.deepEqual([field.text, field.caret, field.draft], [thousand, 5, '1.000'], 'the draft is always the ledger notation');
    const typing = new Field(false, format).typeAll('999999');
    assert.equal(typing.text, format === AR ? '999.999' : '999,999');
    typing.tap(0).type('1');
    assert.deepEqual([typing.text, typing.caret], [format === AR ? '1.999.999' : '1,999,999', 1], 'a caret before a new separator stays before it');
    const grow = new Field(false, format).typeAll('100000');
    grow.type('0');
    assert.deepEqual([grow.text, grow.caret, grow.minor], [million, 9, 100000000]);
    // Backspace back across the boundary.
    grow.backspace();
    assert.deepEqual([grow.text, grow.caret], [format === AR ? '100.000' : '100,000', 7]);
  }
});

test('the same keystrokes give the same amount in all four language × region combinations; only the separators differ', () => {
  // The amount field depends on the region alone; the language never reaches it.
  for (const format of [AR, US]) {
    for (const decimalKey of [',', '.']) {
      // Either key of the decimal pad is the decimal separator: the pad shows the device's, which may not be the app region's.
      const field = new Field(false, format).typeAll('1234567' + decimalKey + '89');
      assert.equal(field.text, format === AR ? '1.234.567,89' : '1,234,567.89', decimalKey);
      assert.equal(field.draft, '1.234.567,89');
      assert.equal(field.minor, 123456789);
      assert.equal(field.caret, field.text.length);
      field.type(decimalKey === ',' ? '.' : ',');
      assert.equal(field.text, format === AR ? '1.234.567,89' : '1,234,567.89', 'a second decimal separator of either kind is ignored');
    }
  }
});

test('United States: editing in the middle, backspace over a comma group, selections and negatives mirror Argentina', () => {
  const field = new Field(false, US).typeAll('1234567.89');
  assert.equal(field.text, '1,234,567.89');
  field.tap(5); // "1,234|,567.89"
  field.type('0');
  assert.deepEqual([field.text, field.caret, field.logical], ['12,340,567.89', 6, 5]);
  field.tap(3); // "12,|340,567.89": right after a group comma
  field.backspace();
  assert.deepEqual([field.text, field.caret], ['1,340,567.89', 1], 'the 2 before the comma goes');
  field.tap(10); // "1,340,567.|89"
  field.backspace();
  assert.deepEqual([field.text, field.draft], ['134,056,789', '134.056.789'], 'deleting the decimal point merges the digits');
  field.replace(0, 11, '');
  assert.equal(field.text, '');
  const negative = new Field(false, US, '-1.234,56');
  assert.equal(negative.text, '-1,234.56', 'a prefilled negative balance renders with US separators');
  negative.backspace();
  assert.deepEqual([negative.text, negative.draft], ['-1,234.5', '-1.234,5']);
  assert.equal(new Field(false, US).paste('−1,000').text, '-1,000');
});

test('a keystroke typed while the native view still shows the previous raw text reads as one keystroke, whatever key the pad shows', () => {
  // Argentina with a US decimal pad ("."), typing faster than the render: the period is the decimal separator.
  const ar = new Field(true, AR).typeAll('3000');
  assert.equal(ar.native.text, '3000', 'the native view lags');
  ar.type('.');
  assert.deepEqual([ar.text, ar.canonical], ['3.000,', '3000,']);
  ar.type('5');
  assert.deepEqual([ar.text, ar.minor], ['3.000,5', 300050], 'the lagging period stays the decimal separator');
  ar.type('0');
  assert.equal(ar.text, '3.000,50');
  // United States with an Argentine pad (","), same speed.
  const us = new Field(true, US).typeAll('3000');
  us.type(',');
  us.type('5');
  assert.deepEqual([us.text, us.minor], ['3,000.5', 300050]);
  // Repeated zeroes in the US never turn a group comma into a decimal.
  const zeros = new Field(true, US).type('3');
  for (let index = 1; index <= 8; index++) zeros.type('0');
  assert.deepEqual([zeros.text, zeros.canonical], ['300,000,000', '300000000']);
  zeros.sync().backspace();
  assert.equal(zeros.text, '30,000,000');
});

test('changing the region with a half-typed amount keeps the value, the draft and the logical caret; only the separators change', () => {
  const field = new Field(false, AR).typeAll('1234567,5');
  field.tap(5); // "1.234|.567,5": after the 4
  const [draft, logical] = [field.draft, field.logical];
  field.region(US);
  assert.deepEqual([field.text, field.draft, field.logical, field.caret], ['1,234,567.5', draft, logical, 5]);
  field.type('9');
  assert.deepEqual([field.text, field.draft], ['12,349,567.5', '12.349.567,5'], 'typing continues where it was, in the new separators');
  field.region(AR);
  assert.deepEqual([field.text, field.caret], ['12.349.567,5', 6]);
  field.settle();
  assert.deepEqual([field.text, field.draft, field.minor], ['12.349.567,50', '12.349.567,50', 1234956750]);
  // A dangling decimal and a lone sign survive a switch too.
  const partial = new Field(false, US).typeAll('-12.');
  partial.region(AR);
  assert.deepEqual([partial.text, partial.draft, partial.caret], ['-12,', '-12,', 4]);
  assert.equal(reformatAmount({ text: '1.234,5', caret: 5 }, AR, US).text, '1,234.5');
  assert.deepEqual(reformatAmount({ text: '1.234,5', caret: 5 }, AR, US), { text: '1,234.5', caret: 5 });
  // Switching to the same format is a no-op.
  const same = new Field(false, AR).typeAll('12');
  const view = same.input.view;
  assert.equal(same.input.reformat({ ...AR }), view);
});

test('drafts are the ledger notation in every region: prefill, display and back to the same minor units', () => {
  for (const minor of [0, 5, 100, 123456, -123456, 999999999999999]) {
    const draft = draftFromMinor(minor);
    assert.equal(draft, formatMinorUnits(minor), 'the prefill draft is what the domain writes');
    assert.equal(parseMinorUnits(draft), minor);
    for (const format of [AR, US]) {
      const field = new Field(false, format, draft);
      assert.equal(field.input.draft, draft, 'mounting the field never rewrites the draft');
      assert.equal(parseMinorUnits(field.input.draft), minor);
    }
  }
  assert.equal(displayAmount('1.234,56', US), '1,234.56');
  assert.equal(displayAmount('-1.234,5', US), '-1,234.5');
  assert.equal(displayAmount('1.234,56'), '1.234,56');
  assert.equal(amountFromMinor(19016250), '190.162,50', 'a shortcut fills a ledger draft; the field shows it in the region');
  assert.equal(new Field(false, US, amountFromMinor(19016250)).text, '190,162.50');
  assert.deepEqual(amountFromDraft('1.234,5'), { negative: false, whole: '1234', decimal: true, fraction: '5', caret: 6 });
  assert.equal(draftFromMinor(Number.MAX_SAFE_INTEGER + 2), '');
  assert.deepEqual(LEDGER_FORMAT, AR);
});

test('settling and adopting a draft in the United States', () => {
  const field = new Field(false, US).typeAll('2000.5');
  assert.equal(field.text, '2,000.5');
  field.settle();
  assert.deepEqual([field.text, field.draft], ['2,000.50', '2.000,50']);
  const shortcut = new Field(false, US).typeAll('12');
  shortcut.input.adopt('1.500');
  assert.deepEqual([shortcut.input.view.text, shortcut.input.view.caret], ['1,500', 5]);
  const empty = new Field(false, US).typeAll('-');
  empty.settle();
  assert.deepEqual([empty.text, empty.draft], ['', '']);
});

test('hero amounts split with the region decimal separator; display caret mapping is the same in both regions', () => {
  assert.deepEqual(splitAmount('$ 1,234.56', US), { prefix: '$ ', whole: '1,234', decimals: '.56' });
  assert.deepEqual(splitAmount('−AR$ 2,000,000.00', US), { prefix: '−AR$ ', whole: '2,000,000', decimals: '.00' });
  assert.deepEqual(splitAmount('US$ 12', US), { prefix: 'US$ ', whole: '12', decimals: '' });
  assert.deepEqual(splitAmount('US$ 1.234,56', AR), { prefix: 'US$ ', whole: '1.234', decimals: ',56' });
  const state = amountFromCanonical('3000000,50')!;
  for (let logical = 0; logical <= 10; logical++) assert.equal(displayCaret(state, logical, US), displayCaret(state, logical, AR));
  assert.equal(renderAmount(state, US).text, '3,000,000.50');
  assert.equal(logicalCaret('3,000,000.50', 6, US), 4);
  assert.equal(shown('-1234567', US), '-1,234,567');
  assert.equal(EMPTY_AMOUNT.whole, '');
});
