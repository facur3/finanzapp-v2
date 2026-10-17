import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEDGER_CURRENCIES } from '@finanzapp/domain';
import { REGION_CODES } from '../src/i18n/regions/data.ts';
import { FLAG_ART } from '../src/i18n/flag-art.ts';
import { SUPPORTED_LANGUAGES } from '../src/i18n/locale.ts';
import { currencyFlag, currencyIssuer, languageFlag, regionFlag } from '../src/i18n/flags.ts';

// 25O1: a region shows its own flag, a currency its issuer's (beside its code), a language its variety's (flags.ts).

test('25O1: every catalogue region and the European Union have round vector art, Sark included', () => {
  assert.deepEqual(Object.keys(FLAG_ART).sort(), [...REGION_CODES, 'EU'].sort(), 'one flag per catalogue region, plus the EU, nothing else');
  for (const code of [...REGION_CODES, 'EU']) {
    assert.equal(regionFlag(code), code, code);
    const shapes = FLAG_ART[code]!;
    assert.ok(shapes.length > 0, code);
    for (const [fill, d] of shapes) {
      assert.match(fill, /^#[0-9a-f]{3}([0-9a-f]{3})?$/i, `${code}: a plain colour`);
      assert.match(d, /^[Mm][-\d. ,a-zA-Z]+$/, `${code}: a path, nothing else`);
    }
  }
  assert.equal(regionFlag('CQ'), 'CQ', 'Sark draws on every iOS release (its emoji needed iOS 18.4)');
  for (const code of ['', 'A', 'ar', 'ZZ', 'ARG', '419', 'XX', 'constructor', '__proto__']) assert.equal(regionFlag(code), null, JSON.stringify(code));
});

test('25O1: a currency is marked by its issuer, the euro by the European Union, a supranational code by nothing', () => {
  assert.deepEqual(['ARS', 'USD', 'EUR', 'GBP', 'JPY', 'BRL'].map(code => [code, currencyIssuer(code)]),
    [['ARS', 'AR'], ['USD', 'US'], ['EUR', 'EU'], ['GBP', 'GB'], ['JPY', 'JP'], ['BRL', 'BR']]);
  assert.equal(currencyFlag('USD'), 'US', 'the issuer, wherever the account is');
  const unmarked = LEDGER_CURRENCIES.filter(code => currencyFlag(code) === null);
  assert.deepEqual([...unmarked].sort(), ['XAF', 'XCD', 'XCG', 'XOF', 'XPF'], 'only the supranational codes of the ledger go unmarked');
  for (const code of ['', 'usd', 'US', 'XDR', 'ZZZ']) assert.equal(currencyFlag(code), null, JSON.stringify(code));
});

test('25O1: a language is marked by the variety its catalogue is written in, which always has a flag', () => {
  assert.deepEqual(SUPPORTED_LANGUAGES.map(language => [language, languageFlag(language)]), [['es', 'AR'], ['en', 'US']],
    'rioplatense Spanish (voseo), American English');
  for (const language of SUPPORTED_LANGUAGES) assert.equal(regionFlag(languageFlag(language)), languageFlag(language), language);
});
