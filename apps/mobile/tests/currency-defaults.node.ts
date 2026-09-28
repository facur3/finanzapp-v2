import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Account } from '@finanzapp/domain';
import { defaultCurrency, suggestedCurrency } from '../src/ui/currency-defaults.ts';

// Producto 25B2: the one rule for the currency a form starts with. Pure; the forms consult it through
// `useDefaultCurrency` (their harnesses prove they do), so every branch is proven here once.
const createdAt = '2026-09-27T12:00:00.000Z';
const account = (id: string, currency: Account['currency'], deletedAt?: string): Account =>
  ({ id, name: id, currency, openingMinor: 0, createdAt, ...(deletedAt ? { revision: 1, updatedAt: deletedAt, deletedAt } : {}) });
const base = { accounts: [] as Account[], displayCurrency: null, region: null } as const;

test('rule 4: with no account yet the region\'s legal tender decides: Spain → EUR, the United States → USD, Argentina → ARS; unknown → ARS', () => {
  assert.equal(defaultCurrency({ ...base, region: 'ES' }), 'EUR');
  assert.equal(defaultCurrency({ ...base, region: 'US' }), 'USD');
  assert.equal(defaultCurrency({ ...base, region: 'AR' }), 'ARS');
  assert.equal(defaultCurrency({ ...base, region: 'JP' }), 'JPY');
  assert.equal(defaultCurrency({ ...base, region: null }), 'ARS', 'rule 5: the technical fallback');
  assert.equal(defaultCurrency({ ...base, region: 'KW' }), 'ARS', 'a held (three-decimal) tender the build does not offer');
  assert.equal(defaultCurrency({ ...base, region: 'KW', gate: ['ARS', 'KWD'] }), 'KWD', 'unless the gate offers it');
  assert.equal(suggestedCurrency('ES'), 'EUR');
});

test('rule 2: one currency held is the currency, whatever the region or the display currency say', () => {
  assert.equal(defaultCurrency({ ...base, accounts: [account('a', 'USD')], region: 'ES', displayCurrency: 'EUR' }), 'USD');
  assert.equal(defaultCurrency({ ...base, accounts: [account('a', 'USD'), account('b', 'USD')], region: 'AR' }), 'USD');
});

test('rule 3: several currencies held → the display currency when an account holds it, else the first held (grouping order)', () => {
  const several = [account('a', 'EUR'), account('b', 'USD'), account('c', 'JPY')];
  assert.equal(defaultCurrency({ ...base, accounts: several, displayCurrency: 'JPY', region: 'ES' }), 'JPY');
  assert.equal(defaultCurrency({ ...base, accounts: several, displayCurrency: 'GBP', region: 'ES' }), 'USD', 'a display currency no account holds: the first held, USD before EUR before JPY');
  assert.equal(defaultCurrency({ ...base, accounts: several, displayCurrency: null, region: 'ES' }), 'USD');
});

test('rule 1: the account the form belongs to, or a route\'s gated currency, wins over everything', () => {
  const several = [account('a', 'EUR'), account('b', 'USD')];
  assert.equal(defaultCurrency({ ...base, accounts: several, displayCurrency: 'USD', region: 'ES', accountCurrency: 'JPY' }), 'JPY');
  assert.equal(defaultCurrency({ ...base, accounts: several, displayCurrency: 'USD', region: 'ES', requested: 'CLP' }), 'CLP');
  assert.equal(defaultCurrency({ ...base, accounts: several, displayCurrency: 'USD', region: 'ES', requested: 'clp' }), 'USD', 'an unknown or ungated code is never coerced');
  assert.equal(defaultCurrency({ ...base, accounts: several, displayCurrency: 'USD', region: 'ES', requested: 'KWD' }), 'USD', 'a held currency outside the gate');
  assert.equal(defaultCurrency({ ...base, requested: 'XAU' }), 'ARS');
});

test('deleted accounts do not count: their currency is history', () => {
  assert.equal(defaultCurrency({ ...base, accounts: [account('a', 'EUR', createdAt)], region: 'US' }), 'USD', 'the only account deleted: back to the region');
  assert.equal(defaultCurrency({ ...base, accounts: [account('a', 'EUR', createdAt), account('b', 'JPY')], displayCurrency: 'EUR' }), 'JPY', 'one live currency left');
});
