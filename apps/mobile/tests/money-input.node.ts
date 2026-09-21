import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { formatMinorUnits, parseMinorUnits } from '@finanzapp/domain';
import { EMPTY_AMOUNT, amountFromCanonical, amountFromMinor, canonicalAmount, displayAmount, displayCaret, logicalCaret, readAmountChange, renderAmount,
  settleAmount, splitAmount, type AmountEdit } from '../src/ui/money-input.ts';

// The amount field keeps a canonical edit state (sign, whole digits, decimal
// comma, fraction, logical caret) and derives the display string and display
// caret from it. These tests drive that state the way the iPhone does: each
// keystroke edits the native display text at the caret, and the native text
// and caret come back through readAmountChange. Presentation only: the
// display string still parses to integer minor units with parseMinorUnits.

/** A simulated native field: the text and caret iOS holds, plus the state we render. */
class Field {
  state: AmountEdit = EMPTY_AMOUNT;
  shown = renderAmount(EMPTY_AMOUNT);
  /** The text the native view actually has; it lags `shown` when `lag` is set. */
  native = { text: '', caret: 0 };
  private lag: boolean;
  constructor(lag = false) { this.lag = lag; }
  private apply(raw: string, rawCaret: number) {
    this.state = readAmountChange(this.shown, raw, rawCaret);
    this.shown = renderAmount(this.state);
    this.native = this.lag ? { text: raw, caret: rawCaret } : { ...this.shown };
  }
  /** Lets a lagging native view catch up with the last render (the controlled update landing). */
  sync() { this.native = { ...this.shown }; return this; }
  type(char: string) {
    const { text, caret } = this.native;
    this.apply(text.slice(0, caret) + char + text.slice(caret), caret + 1);
    return this;
  }
  backspace() {
    const { text, caret } = this.native;
    if (caret === 0) return this;
    this.apply(text.slice(0, caret - 1) + text.slice(caret), caret - 1);
    return this;
  }
  /** Tap: move the caret to a display index (the native selection event). */
  tap(index: number) {
    this.native.caret = index;
    this.shown = { ...this.shown, caret: index };
    this.state = { ...this.state, caret: logicalCaret(this.shown.text, index) };
    return this;
  }
  /** Replace a selected display range with text (typing over a selection, or a paste). */
  replace(start: number, end: number, insert: string) {
    const { text } = this.native;
    this.apply(text.slice(0, start) + insert + text.slice(end), start + insert.length);
    return this;
  }
  paste(insert: string) { return this.replace(this.native.caret, this.native.caret, insert); }
  get text() { return this.shown.text; }
  get caret() { return this.shown.caret; }
  get canonical() { return canonicalAmount(this.state); }
  get logical() { return this.state.caret; }
}

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

test('pasting Argentine and US formatted numbers normalises by the separators the text itself uses', () => {
  const cases: [string, string, string][] = [
    ['2.000.000,50', '2000000,50', '2.000.000,50'], ['2,000,000.50', '2000000,50', '2.000.000,50'],
    ['2000000.5', '2000000,5', '2.000.000,5'], ['2000000', '2000000', '2.000.000'], ['1.000', '1000', '1.000'],
    ['1.000.5', '1000,5', '1.000,5'], ['$ 1.234,56', '1234,56', '1.234,56'], ['US$ 12.30', '12,30', '12,30'],
    ['1,000', '1,00', '1,00'], ['abc', '', ''], ['-500', '-500', '-500'], ['0007', '7', '7'], ['00,70', '0,70', '0,70'],
  ];
  for (const [pasted, canonical, display] of cases) {
    const field = new Field().paste(pasted);
    assert.equal(field.canonical, canonical, pasted);
    assert.equal(field.text, display, pasted);
    assert.equal(field.caret, display.length, pasted + ': the caret lands after the paste');
  }
  const into = new Field();
  for (const key of '99') into.type(key);
  into.tap(1).paste('1.000,5');
  assert.deepEqual([into.canonical, into.text, into.caret], ['91000,59', '91.000,59', 8], 'a paste in the middle keeps its own decimals; the digit after it becomes a decimal');
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
