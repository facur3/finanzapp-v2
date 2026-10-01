import assert from 'node:assert/strict';
import { test } from 'node:test';
import { presentedAmount, type MovementKind } from '../src/ui/movement-amount.ts';

// Producto 24UX6C: how a typed movement's amount is shown. The ledger stores a positive magnitude plus a kind; the
// presentation sign is separate from the ledger meaning and never changes the stored amount.

test('an expense is shown as stored: no sign, in the expense (ink) tone', () => {
  assert.deepEqual(presentedAmount('expense', 123450), { minor: 123450, signed: false, tone: 'expense' });
  assert.deepEqual(presentedAmount('expense', 1), { minor: 1, signed: false, tone: 'expense' });
  assert.deepEqual(presentedAmount('expense', 0), { minor: 0, signed: false, tone: 'expense' });
});

test('an income carries its «+» in the income tone, the magnitude as stored', () => {
  assert.deepEqual(presentedAmount('income', 500000), { minor: 500000, signed: true, tone: 'income' });
  assert.deepEqual(presentedAmount('income', 0), { minor: 0, signed: true, tone: 'income' });
});

test('a transfer is shown as stored: no sign, in the transfer tone', () => {
  assert.deepEqual(presentedAmount('transfer', 250000), { minor: 250000, signed: false, tone: 'transfer' });
});

test('the stored minor units are returned untouched: never negated, never an absolute value, never rounded', () => {
  for (const kind of ['expense', 'income', 'transfer'] as MovementKind[]) {
    // A hypothetical negative stored magnitude (the ledger never writes one) is shown as is: no Math.abs hides it.
    assert.equal(presentedAmount(kind, -4200).minor, -4200, kind);
    assert.equal(presentedAmount(kind, Number.MAX_SAFE_INTEGER).minor, Number.MAX_SAFE_INTEGER, kind);
    assert.equal(presentedAmount(kind, 999999999999999).minor, 999999999999999, kind);
    // Only income is signed, whatever the magnitude.
    assert.equal(presentedAmount(kind, -4200).signed, kind === 'income', kind);
    assert.equal(presentedAmount(kind, -4200).tone, kind, kind);
  }
  assert.ok(Object.is(presentedAmount('expense', -0).minor, -0), 'even a negative zero passes through as stored');
});

test('it reads its inputs without changing them and returns a fresh object each time', () => {
  const entry = Object.freeze({ kind: 'expense' as MovementKind, amountMinor: 98765 });
  const before = JSON.stringify(entry);
  const first = presentedAmount(entry.kind, entry.amountMinor);
  const second = presentedAmount(entry.kind, entry.amountMinor);
  assert.equal(JSON.stringify(entry), before, 'the movement is unchanged');
  assert.notEqual(first, second, 'no shared result a caller could mutate for another row');
  first.minor = 1;
  assert.equal(second.minor, 98765);
  assert.equal(presentedAmount(entry.kind, entry.amountMinor).minor, 98765);
  assert.deepEqual(Object.keys(first).sort(), ['minor', 'signed', 'tone'], 'only the presentation fields');
});
