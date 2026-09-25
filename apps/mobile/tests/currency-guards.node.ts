import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as domain from '@finanzapp/domain';
import { GENERATED_DIR, GENERATED_HEADER, findLiterals, isGeneratedModule } from '../scripts/i18n/extract.mjs';
import { checkGeneratedModules } from '../scripts/i18n/check.mjs';
import { SUPPORTED_LANGUAGES } from '../src/i18n/locale.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { CLDR_TAG, verifyOutputs } from '../scripts/currency/generate.mjs';

// Producto 24B1, stage 1 of docs/currency.md §7.5: the static safety net. Every place that still
// assumes exactly two currencies is listed here with the stage that removes it; a new one fails.
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MOBILE = fileURLToPath(new URL('../', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'ios' || name === 'android' || name === '.expo') return [];
    return statSync(path).isDirectory() ? walk(path) : /\.(tsx?|js|d\.ts)$/.test(name) && !/\.test\.|\.node\./.test(name) ? [path] : [];
  });
}
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** The pair literals and binary ternaries that remain, each with the stage that removes it, or the reason it is
 * permanent. Every occurrence must match an entry, and every entry must still match something: the list only
 * shrinks. Since 24B3 (stage 4) only the permanent conventions, the production gate and contract v1 remain: the
 * four presentation ternaries became lookups keyed by code and one `{name} · {code}` template. */
const PAIR_PATTERNS = [/\['ARS', 'USD'\]/, /'ARS' \| 'USD'/, /"ARS", "USD"/, /=== 'USD' \?/, /=== 'ARS' \?/, /'USD' : 'ARS'/, /'ARS' : 'USD'/,
  /!== 'ARS' && \w+ !== 'USD'/, /'ARS', 'USD', /];
const ALLOWED_PAIRS: { file: string; includes: string; why: string }[] = [
  { file: 'packages/domain/currency.ts', includes: "LegacyCurrency = 'ARS' | 'USD'", why: 'the two currencies rows and backups from before 24B can name (permanent)' },
  { file: 'packages/domain/currency.ts', includes: "LEGACY_CURRENCIES: readonly LegacyCurrency[] = ['ARS', 'USD']", why: 'permanent' },
  { file: 'packages/domain/currency.ts', includes: "LEDGER_CURRENCIES: readonly IsoCurrencyCode[] = ['ARS', 'USD']", why: 'the production gate; stage 9 changes it in its own commit' },
  { file: 'apps/mobile/src/storage/currency-gate.ts', includes: "PREVIEW_CURRENCIES: CurrencyGate = ['ARS', 'USD', 'EUR', 'GBP', 'JPY', 'CLP', 'KWD']", why: 'the development preview gate (24B5): the release pair plus the test currencies, reachable only in a development bundle' },
  { file: 'packages/integrations/contracts.d.ts', includes: "currency: 'ARS' | 'USD'", why: 'Assistant contract v1 is frozen; stage 7 adds the next version' },
  { file: 'packages/integrations/contracts.js', includes: "['ARS', 'USD'].includes", why: 'Assistant contract v1 is frozen; stage 7 adds the next version' },
  { file: 'server/mobile/openai.js', includes: "enum: ['ARS', 'USD', null]", why: 'the model schema of contract v1; stage 7 imports a generated superset' },
  { file: 'apps/mobile/src/i18n/locale.ts', includes: "dollarSignCurrency: 'ARS' | 'USD' | (string & {}) | null", why: 'a region convention: which currency a bare $ names (permanent; any tender code since the 24R1 catalogue)' },
  { file: 'apps/mobile/src/i18n/format.ts', includes: "currency === 'ARS') return conventions(locale, explicit).dollarSignCurrency === 'ARS' ? '$' : 'AR$'", why: 'the ARS symbol rule (permanent)' },
];

test('24B1: no new place assumes exactly two currencies; the remaining ones are listed with their stage', () => {
  const found: { file: string; line: string }[] = [];
  for (const dir of ['apps/mobile/app', 'apps/mobile/src', 'packages', 'server']) {
    for (const path of walk(join(ROOT, dir))) {
      const file = relative(ROOT, path);
      for (const line of stripComments(readFileSync(path, 'utf8')).split('\n')) {
        if (PAIR_PATTERNS.some(pattern => pattern.test(line))) found.push({ file, line: line.trim() });
      }
    }
  }
  const unexpected = found.filter(item => !ALLOWED_PAIRS.some(allowed => allowed.file === item.file && item.line.includes(allowed.includes)));
  assert.deepEqual(unexpected, [], 'a new two-currency assumption: make it a catalogue predicate, a lookup keyed by code, or list it here with its stage');
  for (const allowed of ALLOWED_PAIRS) {
    assert.ok(found.some(item => item.file === allowed.file && item.line.includes(allowed.includes)), `${allowed.file}: "${allowed.includes}" is gone: remove it from the allow-list (${allowed.why})`);
  }
  // The groupings that used to loop over the pair now follow the data.
  for (const file of ['packages/domain/ledger.ts', 'packages/domain/liabilities.ts', 'packages/domain/budgets.ts', 'packages/domain/spending-overview.ts',
    'apps/mobile/src/ui/presentation.ts', 'apps/mobile/app/backup-import.tsx']) {
    assert.equal(/\['ARS', 'USD'\]/.test(stripComments(readFileSync(join(ROOT, file), 'utf8'))), false, file + ' loops over the currencies present, never the pair');
  }
});

test('24B1: the typed domain entry no longer carries the web float helpers, and storage validates with the domain only', () => {
  assert.equal('fmtNum' in domain, false);
  assert.equal('parseMoneyInput' in domain, false);
  assert.equal(typeof domain.validateNewAccount, 'function');
  assert.equal(typeof domain.validateNewMonthlyBudget, 'function');
  const storage = stripComments(readFileSync(join(MOBILE, 'src/storage/database.ts'), 'utf8'));
  assert.equal(/createAccount[\s\S]*?validateNewAccount\(account, gate\)/.test(storage), true, 'a new account goes through the creation gate');
  assert.equal((storage.match(/validateNewAccount\(account, gate\)/g) ?? []).length, 3, 'accounts, cards and debts are created through the gate (an explicit one in tests only)');
  assert.equal(/validateNewMonthlyBudget\(budget, gate\)/.test(storage), true, 'a new budget goes through the creation gate');
  assert.equal((storage.match(/gate: CurrencyGate = LEDGER_CURRENCIES/g) ?? []).length, 4, 'the production gate is the default of every create function');
  assert.equal(/SELECT \* FROM/.test(storage), false, '24B4: every row is read by its named columns, never SELECT *');
  assert.equal(/readArchive[\s\S]*?validateAccount\(row\)/.test(storage), true, 'stored rows are read with read acceptance only');
  assert.equal(/i18n\//.test(storage), false, 'storage never reads presentation');
});

test('24B1: generated currency-name modules are exempt from the copy scan by directory and header, and the catalogue check requires one per language', () => {
  const dir = join(MOBILE, GENERATED_DIR);
  const generated = readdirSync(dir).filter(name => /^[a-z]{2,3}\.ts$/.test(name));
  assert.deepEqual(generated.map(name => name.slice(0, -3)).sort(), [...SUPPORTED_LANGUAGES].sort());
  for (const name of generated) {
    const source = readFileSync(join(dir, name), 'utf8');
    assert.ok(source.startsWith(GENERATED_HEADER), name + ' carries the GENERATED header');
    assert.equal(isGeneratedModule(GENERATED_DIR + name, source), true);
  }
  assert.equal(isGeneratedModule(GENERATED_DIR + 'fr.ts', 'export const fr = {};'), false, 'a hand-written file in the directory is scanned');
  assert.equal(isGeneratedModule('src/ui/x.ts', GENERATED_HEADER), false, 'the header alone exempts nothing outside the directory');
  const allow = JSON.parse(readFileSync(join(MOBILE, 'i18n', 'extract-allow.json'), 'utf8'));
  assert.equal(Object.keys(allow.files).some(file => file.startsWith(GENERATED_DIR)), false, 'no per-file exemption is needed for a new language');
  assert.deepEqual(findLiterals().filter(item => item.file.startsWith(GENERATED_DIR)), []);
  assert.deepEqual(checkGeneratedModules(), []);
  assert.match(checkGeneratedModules([...SUPPORTED_LANGUAGES, 'fr'])[0], /fr: src\/i18n\/currencies\/fr\.ts is missing/);
  assert.match(checkGeneratedModules(['es'])[0], /en\.ts names a language without a catalogue/);
  const scratch = mkdtempSync(join(tmpdir(), 'finanzapp-currencies-'));
  try {
    writeFileSync(join(scratch, 'es.ts'), 'export const es = {};');
    assert.match(checkGeneratedModules(['es'], scratch)[0], /es\.ts is not the generator's output/);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('24B1: offline integrity (--verify) is separate from regeneration (--check) and catches a hand edit, a stale lock and a wrong CLDR tag', () => {
  const langs = [...SUPPORTED_LANGUAGES].sort();
  assert.deepEqual(verifyOutputs(langs), [], 'the committed catalogue matches the lock');
  const scratch = mkdtempSync(join(tmpdir(), 'finanzapp-catalogue-'));
  try {
    for (const path of ['packages/domain/currency-data.ts', ...langs.map(lang => `apps/mobile/src/i18n/currencies/${lang}.ts`), 'apps/mobile/scripts/currency/sources.lock.json']) {
      cpSync(join(ROOT, path), join(scratch, path));
    }
    const lockPath = join(scratch, 'apps/mobile/scripts/currency/sources.lock.json');
    const options = { root: scratch, lockPath };
    assert.deepEqual(verifyOutputs(langs, options), []);
    // A hand edit that keeps the header still changes the hash.
    const data = join(scratch, 'packages/domain/currency-data.ts');
    writeFileSync(data, readFileSync(data, 'utf8').replace("minorUnit: 0, ", "minorUnit: 2, "));
    assert.match(verifyOutputs(langs, options).join('\n'), /currency-data\.ts differs from the sha256 the lock recorded/);
    // A file without the header is not the generator's, whatever its hash says.
    writeFileSync(data, 'export const CURRENCY_DATA = {};');
    assert.match(verifyOutputs(langs, options).join('\n'), /currency-data\.ts lacks the GENERATED header/);
    // A lock that names another CLDR tag or misses a source.
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    writeFileSync(lockPath, JSON.stringify({ ...lock, cldr: '0.0.0', files: { ...lock.files, 'currencyData.json': undefined } }));
    const problems = verifyOutputs(langs, options).join('\n');
    assert.match(problems, /the lock names CLDR 0\.0\.0, the generator/);
    assert.match(problems, /currencyData\.json is not in the lock/);
    assert.equal(CLDR_TAG, domain.CLDR_VERSION);
    assert.deepEqual(verifyOutputs(langs, { root: scratch, lockPath: join(scratch, 'missing.json') }), ['no sources.lock.json']);
    // A language the generator does not know about is reported as an output the lock does not record.
    assert.match(verifyOutputs([...langs, 'fr'], options).join('\n'), /this generator writes \[.*fr\.ts/);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  assert.match(ci, /npm run currency:verify/, 'CI verifies the committed catalogue on a clean checkout without the source cache');
  assert.match(ci, /npm run i18n:check/, 'CI checks the catalogues and the generated name modules');
  const scripts = JSON.parse(readFileSync(join(MOBILE, 'package.json'), 'utf8')).scripts;
  assert.equal(scripts['currency:verify'], 'node --experimental-strip-types scripts/currency/generate.mjs --verify');
});

test('24B3: screens never format or speak an amount without its currency, never write a catalogue symbol by hand, and the bound locale offers no such call', () => {
  const offenders: string[] = [];
  // Every root symbol of the catalogue that is not a plain code ("€", "JP¥", "US$", "KWD" is a code and is not scanned).
  const symbols = [...new Set(domain.CURRENCY_CODES.map(code => domain.currencyRecord(code)).flatMap(record => [record.symbol, record.narrowSymbol]).filter(symbol => symbol && !/^[A-Z]{3}$/.test(symbol)))];
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const symbolPattern = new RegExp("['\"`](?:" + symbols.map(escape).join('|') + ")\\s?['\"`](?!\\s*:)");
  for (const dir of ['apps/mobile/app', 'apps/mobile/src/ui']) {
    for (const path of walk(join(ROOT, dir))) {
      const file = relative(ROOT, path);
      const source = stripComments(readFileSync(path, 'utf8'));
      if (/\b(formatAmount|spokenNumber)\b/.test(source)) offenders.push(file + ': a currency-less formatter (use formatMoneyAmount / spokenMinor with the currency)');
      if (/formatCount\(\s*Math\.round\(/.test(source) || /\/\s*100\b/.test(source.replace(/\* 100|\/ 100\)%|100%/g, ''))) offenders.push(file + ': cents divided by hand (use formatWholeUnits)');
      if (symbolPattern.test(source)) offenders.push(file + ': a hand-written currency symbol');
    }
  }
  assert.deepEqual(offenders, []);
  assert.ok(symbols.includes('€') && symbols.includes('JP¥') && symbols.includes('US$'), 'the scan is driven by the catalogue');
  const bound = bindLocale('es-AR');
  assert.equal('formatAmount' in bound, false);
  assert.equal('spokenNumber' in bound, false);
  for (const name of ['formatMoneyAmount', 'formatWholeUnits', 'spokenMinor', 'spokenMoney', 'currencyUnit']) assert.equal(typeof bound[name as keyof typeof bound], 'function', name);
  // The one remaining bare 'ARS' in presentation is the region sample, a two-decimal illustration that names no currency.
  const sample = stripComments(readFileSync(join(MOBILE, 'src/ui/locale-options.ts'), 'utf8'));
  assert.match(sample, /formatMoneyAmount\(123456, 'ARS', locale\)/);
});
