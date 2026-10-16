import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEDGER_CURRENCIES } from '@finanzapp/domain';
import { REGION_CODES } from '../src/i18n/regions/data.ts';
import { currencyFlag, currencyIssuer, regionFlag } from '../src/i18n/flags.ts';

// 25O1: a region shows its own flag, a currency its issuer's (beside its code), a language none (flags.ts).
const pair = (flag: string | null) => flag ? [...flag].map(char => char.codePointAt(0)!.toString(16)) : null;

test('25O1: every catalogue region but Sark draws its emoji flag, two regional indicators', () => {
  assert.equal(regionFlag('AR'), '🇦🇷');
  assert.equal(regionFlag('US'), '🇺🇸');
  assert.deepEqual(pair(regionFlag('IC')), ['1f1ee', '1f1e8'], 'the Canary Islands have an emoji flag');
  for (const code of REGION_CODES) {
    const flag = regionFlag(code);
    if (code === 'CQ') { assert.equal(flag, null, 'Sark: Emoji 16, two boxed letters before iOS 18.4'); continue; }
    assert.equal([...flag!].length, 2, code);
    assert.deepEqual([...flag!].map(char => String.fromCharCode(char.codePointAt(0)! - 0x1f1e6 + 65)).join(''), code);
  }
  for (const code of ['', 'A', 'ar', 'ZZ', 'ARG', '419', 'XX']) assert.equal(regionFlag(code), null, JSON.stringify(code));
});

test('25O1: a currency is marked by its issuer, the euro by the European Union, a supranational code by nothing', () => {
  assert.deepEqual(['ARS', 'USD', 'EUR', 'GBP', 'JPY', 'BRL'].map(code => [code, currencyIssuer(code)]),
    [['ARS', 'AR'], ['USD', 'US'], ['EUR', 'EU'], ['GBP', 'GB'], ['JPY', 'JP'], ['BRL', 'BR']]);
  assert.equal(currencyFlag('EUR'), '🇪🇺');
  assert.equal(currencyFlag('USD'), '🇺🇸', 'the issuer, wherever the account is');
  const unmarked = LEDGER_CURRENCIES.filter(code => currencyFlag(code) === null);
  assert.deepEqual([...unmarked].sort(), ['XAF', 'XCD', 'XCG', 'XOF', 'XPF'], 'only the supranational codes of the ledger go unmarked');
  for (const code of ['', 'usd', 'US', 'XDR', 'ZZZ']) assert.equal(currencyFlag(code), null, JSON.stringify(code));
});
