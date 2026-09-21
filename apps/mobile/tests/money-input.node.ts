import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { formatMinorUnits, parseMinorUnits } from '@finanzapp/domain';
import { editAmountInput, settleAmountInput, splitAmount } from '../src/ui/money-input.ts';

// The amount field formats digit grouping while typing (Argentine display:
// dots group thousands, a comma starts the decimals). It is presentation only:
// the form keeps parsing the display string to integer minor units with the
// domain's parseMinorUnits, and no float is created anywhere in the module.

/** Type `keys` one at a time, as an appended edit, starting from `start`. */
function typeKeys(start: string, keys: string): string {
  let value = start;
  for (const key of keys) value = editAmountInput(value, value + key);
  return value;
}

test('typing whole pesos groups thousands as the digits arrive', () => {
  const steps: string[] = [];
  let value = '';
  for (const key of '2000000') { value = editAmountInput(value, value + key); steps.push(value); }
  assert.deepEqual(steps, ['2', '20', '200', '2.000', '20.000', '200.000', '2.000.000']);
});

test('a comma starts the decimals and at most two decimal digits are kept', () => {
  assert.equal(typeKeys('', '2000,5'), '2.000,5');
  assert.equal(typeKeys('', '2000,50'), '2.000,50');
  assert.equal(typeKeys('', '2000,507'), '2.000,50', 'a third decimal digit is ignored');
  assert.equal(typeKeys('', '2000000,50'), '2.000.000,50');
  assert.equal(typeKeys('', ','), '0,', 'a leading comma shows the zero it implies');
  assert.equal(typeKeys('', ',5'), '0,5');
  assert.equal(typeKeys('', '0,5'), '0,5');
  assert.equal(typeKeys('', '2000,,5'), '2.000,5', 'a second comma is ignored');
});

test('a typed period (en-US decimal pad) is a decimal separator, never a thousands group', () => {
  assert.equal(typeKeys('', '2000.5'), '2.000,5');
  assert.equal(typeKeys('', '2000.50'), '2.000,50');
  assert.equal(typeKeys('', '12345.'), '12.345,', 'the caret can rest after the separator while typing');
  assert.equal(typeKeys('', '1.5'), '1,5');
});

test('deleting works through grouping dots: backspace over a dot removes the digit before it', () => {
  assert.equal(editAmountInput('1.234', '1.23'), '123', 'backspace on the last digit');
  assert.equal(editAmountInput('12.345', '12345'), '1.345', 'backspace on a grouping dot removes the digit before it');
  assert.equal(editAmountInput('2.000.000', '2.000000'), '200.000');
  assert.equal(editAmountInput('2.000,50', '2.000,5'), '2.000,5');
  assert.equal(editAmountInput('2.000,5', '2.000,'), '2.000,');
  assert.equal(editAmountInput('2.000,', '2.000'), '2.000');
  assert.equal(editAmountInput('2.000,50', '2.00050'), '200.050', 'deleting the comma merges the digits, as in any text field');
  assert.equal(editAmountInput('2', ''), '', 'the last digit leaves an empty field');
  assert.equal(editAmountInput('0,', '0'), '0');
  assert.equal(editAmountInput('1.234.567', '1.234.567'), '1.234.567', 'no edit is a no-op');
});

test('insertion and backspace at every caret position: end, before a dot, after a dot, in the middle', () => {
  // The raw text is what iOS reports after the keystroke; the caret position is where the change sits.
  const base = '3.000.000';
  assert.equal(editAmountInput(base, '3.000.0005'), '30.000.005', 'insert at the end');
  assert.equal(editAmountInput(base, '3.000.00'), '300.000', 'backspace at the end');
  assert.equal(editAmountInput(base, '35.000.000'), '35.000.000', 'insert before the first dot');
  assert.equal(editAmountInput(base, '3.0005.000'), '30.005.000', 'insert before the second dot');
  assert.equal(editAmountInput(base, '3.5000.000'), '35.000.000', 'insert after the first dot');
  assert.equal(editAmountInput(base, '3.000.5000'), '30.005.000', 'insert after the second dot');
  assert.equal(editAmountInput(base, '3.050.000'), '3.050.000', 'insert in the middle of a group');
  assert.equal(editAmountInput(base, '.000.000'), '0', 'backspace on the first digit leaves the zeros, which collapse');
  assert.equal(editAmountInput(base, '3000.000'), '0', 'backspace on the first dot removes the digit before it (the 3), and the zeros collapse');
  assert.equal(editAmountInput(base, '3.000000'), '300.000', 'backspace on the second dot removes the digit before it');
  assert.equal(editAmountInput(base, '3.00.000'), '300.000', 'backspace in the middle of a group');
  assert.equal(editAmountInput('3.000,50', '3.0000,50'), '30.000,50', 'insert before the comma');
  assert.equal(editAmountInput('3.000,50', '3.000,5'), '3.000,5', 'backspace at the end of the decimals');
});

test('replacing a selection and inserting in the middle keep the digits the user meant', () => {
  assert.equal(editAmountInput('1.234.567', '1.967'), '1.967', 'a selection across a dot replaced by one digit');
  assert.equal(editAmountInput('1.234.567', '19.234.567'), '19.234.567', 'insert before the first group');
  assert.equal(editAmountInput('123.456', '1203.456'), '1.203.456', 'insert inside a group');
  assert.equal(editAmountInput('1.234.567', ''), '', 'select all and delete');
  assert.equal(editAmountInput('1.234.567', '9'), '9', 'select all and type');
  assert.equal(editAmountInput('1.234,50', '1.234,50'), '1.234,50');
});

test('pasting formatted numbers is normalised by the separators the text actually uses', () => {
  assert.equal(editAmountInput('', '2.000.000,50'), '2.000.000,50', 'Argentine grouping and comma');
  assert.equal(editAmountInput('', '2,000,000.50'), '2.000.000,50', 'US grouping and period');
  assert.equal(editAmountInput('', '2000000.5'), '2.000.000,5', 'plain period decimal');
  assert.equal(editAmountInput('', '2000000'), '2.000.000');
  assert.equal(editAmountInput('', '1.000'), '1.000', 'a lone dot followed by three digits is a group');
  assert.equal(editAmountInput('', '1.000.5'), '1.000,5', 'the last irregular dot is the decimal');
  assert.equal(editAmountInput('', '$ 1.234,56'), '1.234,56', 'currency symbols and spaces are dropped');
  assert.equal(editAmountInput('', 'US$ 12.30'), '12,30');
  assert.equal(editAmountInput('', '1,000'), '1,00', 'a comma is always decimal; the third decimal is dropped');
  assert.equal(editAmountInput('', 'abc'), '', 'letters never become an amount');
  assert.equal(editAmountInput('', '-500'), '-500', 'a leading minus is kept: a corrected balance can be negative, and the domain validates the sign');
  assert.equal(editAmountInput('', '0007'), '7', 'leading zeros vanish');
  assert.equal(editAmountInput('', '00,70'), '0,70');
});

test('long numbers stop at the safe range instead of drifting', () => {
  const thirteen = '9999999999999';
  assert.equal(editAmountInput('', thirteen), '9.999.999.999.999');
  assert.equal(editAmountInput('9.999.999.999.999', '9.999.999.999.9999'), '9.999.999.999.999', 'a fourteenth whole digit is refused');
  assert.equal(editAmountInput('9.999.999.999.999', '9.999.999.999.999,99'), '9.999.999.999.999,99', 'decimals still fit');
  assert.ok(parseMinorUnits('9.999.999.999.999,99') <= Number.MAX_SAFE_INTEGER);
});

test('the display string round-trips through the domain parser to exact minor units', () => {
  const cases: [string, number][] = [
    ['2', 200], ['20', 2000], ['200', 20000], ['2.000', 200000], ['20.000', 2000000], ['200.000', 20000000],
    ['2.000.000', 200000000], ['2.000.000,50', 200000050], ['0,5', 50], ['0,05', 5], ['1.234.567,89', 123456789],
  ];
  for (const [display, minor] of cases) {
    assert.equal(parseMinorUnits(display), minor, display);
    assert.equal(editAmountInput('', display), display, 'the display form is a fixed point of the formatter');
    assert.equal(editAmountInput('', formatMinorUnits(minor)), formatMinorUnits(minor), 'a stored amount renders unchanged');
    assert.equal(parseMinorUnits(editAmountInput('', formatMinorUnits(minor))), minor);
  }
  // Same digits typed with a period or a comma give the same integer: presentation never changes the value.
  assert.equal(parseMinorUnits(typeKeys('', '1234567.89')), parseMinorUnits(typeKeys('', '1234567,89')));
  assert.equal(parseMinorUnits(typeKeys('', '1234567.89')), 123456789);
});

test('a negative recorded balance keeps its sign through every edit', () => {
  assert.equal(formatMinorUnits(-123456), '-1.234,56');
  assert.equal(editAmountInput('', formatMinorUnits(-123456)), '-1.234,56', 'a prefilled negative balance renders unchanged');
  assert.equal(editAmountInput('-1.234,56', '-1.234,5'), '-1.234,5', 'editing the cents never drops the sign');
  assert.equal(editAmountInput('-1.234,56', '-12.234,56'), '-12.234,56');
  assert.equal(editAmountInput('-1.234,56', '1.234,56'), '1.234,56', 'deleting the minus makes it positive');
  assert.equal(editAmountInput('', '-'), '-', 'a minus can be typed first');
  assert.equal(typeKeys('-', '500'), '-500');
  assert.equal(editAmountInput('', '−1.000'), '-1.000', 'the typographic minus is normalised');
  assert.equal(settleAmountInput('-'), '', 'a lone minus settles to empty');
  assert.equal(settleAmountInput('-1.234,5'), '-1.234,50');
  assert.equal(parseMinorUnits(editAmountInput('', '-1.234,56')), -123456);
});

test('ARS and USD use the same Argentine grouping; the currency only changes the label', () => {
  for (const currency of ['ARS', 'USD']) assert.equal(typeKeys('', '1234.5'), '1.234,5', currency);
});

test('settling on blur drops a dangling comma and completes the decimals without touching the value', () => {
  assert.equal(settleAmountInput('2.000,'), '2.000');
  assert.equal(settleAmountInput('2.000,5'), '2.000,50');
  assert.equal(settleAmountInput('2.000'), '2.000', 'a whole amount does not grow ,00');
  assert.equal(settleAmountInput(''), '');
  assert.equal(settleAmountInput('0,'), '0');
  assert.equal(parseMinorUnits(settleAmountInput('2.000,5')), parseMinorUnits('2.000,5'));
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
