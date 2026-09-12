import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Account, Entry } from '@finanzapp/domain';
import { availableCurrencies, groupEntries, initialAccountId, selectEntries } from '../src/ui/presentation.ts';

// Synthetic fixtures only; never loaded by the app or stored in a user database.
const accounts: Account[] = [
  { id: 'ars', name: 'Cuenta de prueba', currency: 'ARS', openingMinor: 0, createdAt: '2026-09-10T12:00:00Z' },
  { id: 'usd', name: 'Dólares de prueba', currency: 'USD', openingMinor: 0, createdAt: '2026-09-10T12:00:00Z' },
];
const base: Entry = { id: 'a', accountId: 'ars', kind: 'expense', amountMinor: 123456, merchant: 'Café de prueba', category: 'Comida', dateISO: '2026-09-11', createdAt: '2026-09-11T12:00:00Z' };
const entries: Entry[] = [base, { ...base, id: 'b', accountId: 'usd', kind: 'income', merchant: 'Cobro de prueba', category: 'Trabajo', dateISO: '2026-09-12' }, { ...base, id: 'c', createdAt: '2026-09-11T13:00:00Z' }];

test('activity is newest first without changing the stored entries', () => {
  const before = JSON.stringify(entries);
  assert.deepEqual(selectEntries(entries, accounts).map(entry => entry.id), ['b', 'c', 'a']);
  assert.equal(JSON.stringify(entries), before);
});
test('search matches accents, case, category and account with all query terms', () => {
  assert.deepEqual(selectEntries(entries, accounts, 'all', ' CAFE  comida ').map(entry => entry.id), ['c', 'a']);
  assert.deepEqual(selectEntries(entries, accounts, 'all', 'dolares').map(entry => entry.id), ['b']);
  assert.equal(selectEntries(entries, accounts, 'all', 'cafe trabajo').length, 0);
});
test('kind and account filters do not mix matching records from another account', () => {
  assert.deepEqual(selectEntries(entries, accounts, 'income').map(entry => entry.id), ['b']);
  assert.equal(selectEntries(entries, accounts, 'expense', '', 'usd').length, 0);
  assert.equal(selectEntries(entries, accounts, 'all', '', 'missing').length, 0);
});
test('date groups preserve dates and all selected rows, with no invented empty days', () => {
  const selected = selectEntries(entries, accounts);
  const groups = groupEntries(selected);
  assert.deepEqual(groups.map(section => [section.dateISO, section.data.length]), [['2026-09-12', 1], ['2026-09-11', 2]]);
  assert.deepEqual(groups.flatMap(section => section.data), selected);
  assert.deepEqual(groupEntries([]), []);
});
test('account preselection follows an explicit account, then currency, then existing data', () => {
  assert.equal(initialAccountId(accounts, undefined, 'USD'), 'usd');
  assert.equal(initialAccountId(accounts, 'ars', 'USD'), 'ars');
  assert.equal(initialAccountId(accounts, 'missing', 'USD'), 'usd');
  assert.equal(initialAccountId(accounts, undefined, 'EUR'), 'ars');
  assert.equal(initialAccountId([]), '');
});
test('currency choices include only currencies with an account, even when balance is zero', () => {
  assert.deepEqual(availableCurrencies([]), []);
  assert.deepEqual(availableCurrencies([accounts[1]]), ['USD']);
  assert.deepEqual(availableCurrencies([...accounts, accounts[0]]), ['ARS', 'USD']);
});
test('equal dates and instants have deterministic order, including timezone offsets', () => {
  const tied = [{ ...base, id: 'x', createdAt: '2026-09-11T09:00:00-03:00' }, { ...base, id: 'y', createdAt: '2026-09-11T12:00:00Z' }];
  assert.deepEqual(selectEntries(tied, accounts).map(entry => entry.id), ['y', 'x']);
});
