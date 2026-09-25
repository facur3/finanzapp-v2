import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Account, Entry, Transfer } from '@finanzapp/domain';
import { availableCurrencies, groupEntries, initialAccountId, selectEntries, selectTransfers, mergeActivity, groupActivity, activityDateLabel, dayNetMinor, homeNamesCategory, sharedGlyphs } from '../src/ui/presentation.ts';

// Synthetic fixtures only; never loaded by the app or stored in a user database.
const accounts: Account[] = [
  { id: 'ars', name: 'Cuenta de prueba', currency: 'ARS', openingMinor: 0, createdAt: '2026-09-10T12:00:00Z' },
  { id: 'usd', name: 'Dólares de prueba', currency: 'USD', openingMinor: 0, createdAt: '2026-09-10T12:00:00Z' },
];
const base: Entry = { id: 'a', accountId: 'ars', kind: 'expense', amountMinor: 123456, merchant: 'Café de prueba', category: 'Comida', dateISO: '2026-09-11', createdAt: '2026-09-11T12:00:00Z' };
const entries: Entry[] = [base, { ...base, id: 'b', accountId: 'usd', kind: 'income', merchant: 'Cobro de prueba', category: 'Trabajo', dateISO: '2026-09-12' }, { ...base, id: 'c', createdAt: '2026-09-11T13:00:00Z' }];

test('transfers match both account sides and all search terms without modifying data', () => {
  const extra = { ...accounts[0], id: 'dest', name: 'Destino' };
  const transfer: Transfer = { id: 'a', fromAccountId: 'ars', toAccountId: 'dest', amountMinor: 1, note: 'Ahorro', dateISO: base.dateISO, createdAt: base.createdAt };
  const all = [...accounts, extra];
  for (const id of ['ars', 'dest']) assert.deepEqual(selectTransfers([transfer], all, '', id), [transfer]);
  assert.deepEqual(selectTransfers([transfer], all, 'TRANSFERÉNCIA destino ahorro'), [transfer]);
  assert.deepEqual(selectTransfers([transfer], all, '', 'usd'), []);
  assert.deepEqual(selectTransfers([transfer], all, 'no coincide'), []);
  const mixed = mergeActivity(entries, [transfer]);
  assert.equal(mixed.length, 4);
  assert.equal(new Set(mixed.map(item => item.key)).size, 4); // Identical entry/transfer IDs are namespaced.
  assert.equal(mixed[0].value.dateISO, '2026-09-12');
  assert.deepEqual(groupActivity(mixed).flatMap(s => s.data), mixed);
  assert.equal(entries[0], base);
});

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

test('the transfer filter lists no entries; section labels stay truthful across today, weekdays and years', () => {
  assert.deepEqual(selectEntries(entries, accounts, 'transfer'), []);
  assert.equal(activityDateLabel('2026-09-20', '2026-09-20'), 'Hoy · 20 sep');
  assert.equal(activityDateLabel('2026-09-19', '2026-09-20'), 'Ayer · 19 sep');
  assert.equal(activityDateLabel('2026-09-17', '2026-09-20'), 'jueves · 17 sep');
  assert.equal(activityDateLabel('2026-09-13', '2026-09-20'), '13 sep');
  assert.equal(activityDateLabel('2025-12-31', '2026-09-20'), '31 dic 2025');
});
test('a day net total only exists for entries of one currency and never counts transfers', () => {
  assert.deepEqual(dayNetMinor([base, { ...base, id: 'i', kind: 'income', amountMinor: 200000 }], accounts), { currency: 'ARS', minor: 200000 - 123456 });
  assert.equal(dayNetMinor(entries, accounts), null);
  assert.equal(dayNetMinor([], accounts), null);
  assert.equal(dayNetMinor([{ ...base, accountId: 'missing' }], accounts), null);
});

test('24UX5: search finds merchant, stored category, the localized category name and account; notes exist only on transfers', () => {
  const at = '2026-09-12T12:00:00Z';
  const accounts: Account[] = [{ id: 'a', name: 'Banco Nación', currency: 'ARS', openingMinor: 0, createdAt: at }, { id: 'b', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt: at }];
  const entries = [{ id: 'e', accountId: 'a', kind: 'expense' as const, amountMinor: 100, merchant: 'Café Martínez', category: 'Comida', dateISO: '2026-09-10', createdAt: at }];
  const english = (entry: { category: string }) => entry.category === 'Comida' ? 'Food' : entry.category;
  for (const query of ['cafe', 'martinez', 'comida', 'food', 'nacion', 'banco cafe']) {
    assert.equal(selectEntries(entries, accounts, 'all', query, undefined, english).length, 1, query);
  }
  assert.equal(selectEntries(entries, accounts, 'all', 'alquiler', undefined, english).length, 0);
  // An expense or income has no note of its own (Entry carries none), so there is nothing else to match.
  assert.equal(Object.hasOwn(entries[0], 'note'), false);
  const transfers = [{ id: 't', fromAccountId: 'a', toAccountId: 'b', amountMinor: 100, note: 'Ahorro vacaciones', dateISO: '2026-09-10', createdAt: at }];
  assert.equal(selectTransfers(transfers, accounts, 'vacaciones').length, 1, 'a transfer note is searchable');
  assert.equal(selectTransfers(transfers, accounts, 'transfer', undefined, 'transfer').length, 1, 'the word in the interface language');
  assert.equal(selectTransfers(transfers, accounts, 'efectivo').length, 1, 'either account');
});

test('24UX5: Inicio names the category only when the name and the glyph do not already say it', () => {
  assert.equal(homeNamesCategory('Carrefour', 'Supermercado', false), false);
  for (const weak of ['f', 'a', 'ok', '123', '—', '  x  ', 'Varios', 'PAGO', 'Unknown', 'sin nombre']) assert.equal(homeNamesCategory(weak, 'Comida', false), true, weak);
  assert.equal(homeNamesCategory('Comida', 'Comida', true), false, 'a name that is the category never repeats it');
  assert.equal(homeNamesCategory('comída ', 'Comida', false), false, 'compared without case, accents or spacing');
  assert.equal(homeNamesCategory('Carrefour', 'Supermercado', true), true, 'a glyph shared with another category on screen');
  assert.deepEqual([...sharedGlyphs([{ category: 'Comida', glyph: 'g1' }, { category: 'Comida', glyph: 'g1' }, { category: 'Café', glyph: 'g1' }, { category: 'Ocio', glyph: 'g2' }])], ['g1']);
  assert.equal(sharedGlyphs([{ category: 'Comida', glyph: 'g1' }, { category: 'Comida', glyph: 'g1' }]).size, 0, 'the same category twice is not ambiguous');
});
