// npm run currency:generate — builds FinanzApp's currency catalogue from its two
// public sources, deterministically, and never by hand:
//   - ISO 4217 List One (SIX Financial Information AG, the ISO 4217 maintenance
//     agency): codes, numeric codes, minor units, fund markers;
//   - Unicode CLDR (cldr-json at a pinned tag): display digits and cash rounding,
//     the language-neutral and narrow symbols, where each currency is legal
//     tender, and the currency and territory names of every language FinanzApp
//     carries (LANGUAGES in src/i18n/locale.ts).
// Outputs (committed, never edited by hand):
//   packages/domain/currency-data.ts          codes, minor units, CLDR digits, symbols, kind, status, territories
//   src/i18n/currencies/<language>.ts         names (display, one, other) and territory names for search
// Modes (docs/currency.md §4 tells them apart):
//   (default)    REGENERATE: read the cached sources (i18n/work/currency-sources, ignored by git),
//                check their sha256 against scripts/currency/sources.lock.json, write the outputs
//                and record each output's sha256 in the lock
//   --download   REFRESH: fetch the pinned URLs into the cache first, then record their sha256, size
//                and retrieval date in the lock, then regenerate (the only mode that needs the network)
//   --check      REGENERATE AND COMPARE: write nothing; exit 1 when the committed outputs (or their
//                sha256 in the lock) differ from a fresh generation. Needs the cached sources.
//   --verify     INTEGRITY, OFFLINE: needs neither the network nor the cache. Exit 1 when a committed
//                output's sha256 differs from the one the lock recorded, when a generated file lacks
//                its GENERATED header, or when the lock is inconsistent with this generator (CLDR tag,
//                source list). This is what CI runs on a clean checkout; it proves nobody edited a
//                generated file by hand, not that upstream data is unchanged.
// No dependency, no paid service. docs/currency.md explains the data, the licences and the update.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MOBILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = join(MOBILE, '..', '..');
const CACHE = join(MOBILE, 'i18n', 'work', 'currency-sources');
const LOCK = join(MOBILE, 'scripts', 'currency', 'sources.lock.json');
const DOMAIN_OUT = join(ROOT, 'packages', 'domain', 'currency-data.ts');
const NAMES_DIR = join(MOBILE, 'src', 'i18n', 'currencies');

/** The pinned CLDR release. Changing it is a reviewed decision (docs/currency.md §4). */
export const CLDR_TAG = '48.2.0';
const CLDR_BASE = `https://raw.githubusercontent.com/unicode-org/cldr-json/${CLDR_TAG}/cldr-json`;
const ISO_LIST_ONE = 'https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml';

/** ISO 4217 codes whose minor unit is "N.A.", classified by what they are. A new
 * N.A. code stops the generator: someone decides its kind before it enters the data. */
const NON_NUMERIC_KINDS = {
  XAG: 'metal', XAU: 'metal', XPD: 'metal', XPT: 'metal',
  XBA: 'unit', XBB: 'unit', XBC: 'unit', XBD: 'unit', XDR: 'unit', XSU: 'unit', XUA: 'unit',
  XTS: 'test', XXX: 'none',
};

async function languages() {
  const locale = await import(pathToFileURL(join(MOBILE, 'src', 'i18n', 'locale.ts')).href);
  return [...locale.SUPPORTED_LANGUAGES].sort();
}

function sources(langs) {
  return [
    { file: 'list-one.xml', url: ISO_LIST_ONE },
    { file: 'currencyData.json', url: `${CLDR_BASE}/cldr-core/supplemental/currencyData.json` },
    { file: 'currencies-und.json', url: `${CLDR_BASE}/cldr-numbers-full/main/und/currencies.json` },
    ...langs.flatMap(lang => [
      { file: `currencies-${lang}.json`, url: `${CLDR_BASE}/cldr-numbers-full/main/${lang}/currencies.json` },
      { file: `territories-${lang}.json`, url: `${CLDR_BASE}/cldr-localenames-full/main/${lang}/territories.json` },
    ]),
  ];
}

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

async function download(list) {
  mkdirSync(CACHE, { recursive: true });
  const lock = { about: 'Sources of the currency catalogue: URL, sha256 and size of the exact bytes the committed data was generated from. Updated only by `npm run currency:generate -- --download`.', cldr: CLDR_TAG, files: {} };
  for (const source of list) {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`${source.url}: HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(join(CACHE, source.file), buffer);
    lock.files[source.file] = { url: source.url, sha256: sha256(buffer), bytes: buffer.length, retrieved: new Date().toISOString().slice(0, 10) };
  }
  const previous = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : null;
  // Keep the earlier retrieval date for bytes that did not change, so a re-download of identical data changes nothing.
  for (const [file, entry] of Object.entries(lock.files)) {
    const old = previous?.files?.[file];
    if (old && old.sha256 === entry.sha256) entry.retrieved = old.retrieved;
  }
  if (previous?.outputs) lock.outputs = previous.outputs;
  writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
}

function readSources(list) {
  if (!existsSync(LOCK)) throw new Error('No sources.lock.json: run `npm run currency:generate -- --download` first.');
  const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
  if (lock.cldr !== CLDR_TAG) throw new Error(`The lock names CLDR ${lock.cldr}, the generator ${CLDR_TAG}: run with --download.`);
  const out = {};
  for (const source of list) {
    const path = join(CACHE, source.file), entry = lock.files[source.file];
    if (!entry || entry.url !== source.url) throw new Error(`${source.file} is not in the lock with ${source.url}: run with --download.`);
    if (!existsSync(path)) throw new Error(`${relative(MOBILE, path)} is missing: run with --download.`);
    const buffer = readFileSync(path);
    if (sha256(buffer) !== entry.sha256) throw new Error(`${source.file} differs from the lock (sha256): run with --download and review the diff.`);
    out[source.file] = buffer.toString('utf8');
  }
  return { files: out, lock };
}

const decodeXml = text => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** ISO 4217 List One: one entry per country; a code appears once per country that uses it. */
export function parseListOne(xml) {
  const published = /<ISO_4217\s+Pblshd="(\d{4}-\d{2}-\d{2})"/.exec(xml)?.[1];
  if (!published) throw new Error('list-one.xml: no Pblshd date.');
  const codes = new Map();
  for (const match of xml.matchAll(/<CcyNtry>([\s\S]*?)<\/CcyNtry>/g)) {
    const block = match[1];
    const field = tag => { const found = new RegExp(`<${tag}(\\s[^>]*)?>([^<]*)</${tag}>`).exec(block); return found ? { attrs: found[1] ?? '', text: decodeXml(found[2].trim()) } : null; };
    const code = field('Ccy')?.text;
    if (!code) continue; // Territories with "No universal currency".
    const numeric = field('CcyNbr')?.text, minor = field('CcyMnrUnts')?.text, name = field('CcyNm');
    if (!/^[A-Z]{3}$/.test(code) || !/^\d{3}$/.test(numeric ?? '') || !minor || !name) throw new Error(`list-one.xml: malformed entry for ${code}.`);
    const entry = { code, numeric, minorUnit: minor === 'N.A.' ? null : Number(minor), fund: /IsFund="true"/.test(name.attrs) };
    if (entry.minorUnit !== null && !(Number.isInteger(entry.minorUnit) && entry.minorUnit >= 0 && entry.minorUnit <= 4)) throw new Error(`list-one.xml: ${code} minor unit ${minor}.`);
    const seen = codes.get(code);
    if (seen && (seen.numeric !== entry.numeric || seen.minorUnit !== entry.minorUnit || seen.fund !== entry.fund)) throw new Error(`list-one.xml: ${code} is inconsistent across countries.`);
    codes.set(code, entry);
  }
  return { published, codes };
}

const cldrMain = (text, lang) => JSON.parse(text).main[lang];

export function build(files, langs) {
  const { published, codes } = parseListOne(files['list-one.xml']);
  const currencyData = JSON.parse(files['currencyData.json']).supplemental.currencyData;
  const fractions = currencyData.fractions;
  const und = cldrMain(files['currencies-und.json'], 'und').numbers.currencies;
  const names = Object.fromEntries(langs.map(lang => [lang, cldrMain(files[`currencies-${lang}.json`], lang).numbers.currencies]));
  const territoryNames = Object.fromEntries(langs.map(lang => [lang, cldrMain(files[`territories-${lang}.json`], lang).localeDisplayNames.territories]));

  // Legal tender per territory on the day ISO published its list (a fixed date from the sources, so the
  // output does not depend on when it is generated): started on or before it, not ended by it, and not
  // marked _tender="false". A scheduled change (a euro adoption) counts from its date.
  const tender = new Map();
  const onDay = (date, day) => String(date).slice(0, 10) <= day;
  for (const [region, list] of Object.entries(currencyData.region)) {
    if (!/^[A-Z]{2}$/.test(region)) continue;
    for (const item of list) for (const [code, info] of Object.entries(item)) {
      if (info._tender === 'false' || (info._from && !onDay(info._from, published)) || (info._to && onDay(info._to, published))) continue;
      if (!tender.has(code)) tender.set(code, new Set());
      tender.get(code).add(region);
    }
  }

  const records = [];
  for (const entry of [...codes.values()].sort((a, b) => a.code.localeCompare(b.code, 'en'))) {
    let kind;
    if (entry.minorUnit === null) {
      kind = NON_NUMERIC_KINDS[entry.code];
      if (!kind) throw new Error(`${entry.code} has minor unit N.A. and no kind: classify it in NON_NUMERIC_KINDS.`);
    } else kind = entry.fund ? 'fund' : 'fiat';
    const fraction = fractions[entry.code] ?? fractions.DEFAULT;
    const digits = Number(fraction._digits ?? fractions.DEFAULT._digits);
    const rounding = Number(fraction._rounding ?? fractions.DEFAULT._rounding);
    const territories = [...(tender.get(entry.code) ?? [])].sort();
    // A fiat code no CLDR territory lists as current legal tender (SVC: El Salvador uses USD; VED: tender="false")
    // is not offered until someone decides it should be.
    const missing = kind !== 'fiat' ? [] : [...langs.filter(lang => !names[lang][entry.code]?.['displayName-count-other']).map(lang => 'name:' + lang),
      ...(territories.length ? [] : ['tender'])];
    records.push({
      code: entry.code, numeric: entry.numeric, minorUnit: entry.minorUnit, digits, rounding,
      cashDigits: Number(fraction._cashDigits ?? digits), cashRounding: Number(fraction._cashRounding ?? rounding),
      kind, status: kind !== 'fiat' ? 'excluded' : missing.length ? 'incomplete' : 'ready', missing,
      symbol: und[entry.code]?.symbol ?? entry.code,
      narrowSymbol: und[entry.code]?.['symbol-alt-narrow'] ?? und[entry.code]?.symbol ?? entry.code,
      territories,
    });
  }

  // The language-neutral symbol must name one fiat currency only, or it is not a symbol FinanzApp can show.
  const bySymbol = new Map();
  for (const record of records.filter(item => item.kind === 'fiat' && item.symbol !== item.code)) {
    if (bySymbol.has(record.symbol)) throw new Error(`Symbol ${record.symbol} names ${bySymbol.get(record.symbol)} and ${record.code}.`);
    bySymbol.set(record.symbol, record.code);
  }
  for (const code of ['ARS', 'USD']) {
    const record = records.find(item => item.code === code);
    if (!record || record.minorUnit !== 2 || record.status !== 'ready') throw new Error(`${code} must stay a ready currency with minor unit 2.`);
  }
  return { published, records, names, territoryNames };
}

const q = value => JSON.stringify(value);
const HEADER_SOURCES = (published, lock) => [
  ` * Sources: ISO 4217 List One published ${published} (SIX Financial Information AG, the ISO 4217`,
  ` * maintenance agency) and Unicode CLDR ${lock.cldr} (cldr-json; data under the Unicode License v3,`,
  ` * LICENSES/Unicode-3.0.txt). Exact files and sha256: apps/mobile/scripts/currency/sources.lock.json.`,
];

function domainModule({ published, records }, lock) {
  const lines = [
    '/* GENERATED by apps/mobile/scripts/currency/generate.mjs (`npm run currency:generate`). Do not edit.',
    ...HEADER_SOURCES(published, lock),
    ' * What each field means and how to update: docs/currency.md. This file is data; packages/domain/',
    ' * currency.ts is the API. `minorUnit` is ISO 4217\'s and is the ledger exponent of a currency once it',
    ' * can be stored; `digits`/`rounding`/`cashDigits`/`cashRounding` are CLDR\'s formatting data (never a',
    ' * reason to round a recorded amount). */',
    '',
    '/** fiat: a currency of a country or monetary union; fund: an ISO fund code (not money a person spends);',
    ' * metal, unit (units of account, SDR), test and none (XXX): never money in the ledger. */',
    "export type CurrencyKind = 'fiat' | 'fund' | 'metal' | 'unit' | 'test' | 'none';",
    '/** ready: fiat with complete data in every language this build carries; incomplete: fiat missing some',
    ' * data (listed in `missing`); excluded: not fiat. Whether a currency can be stored is decided in',
    ' * currency.ts (LEDGER_CURRENCIES), never here. */',
    "export type CurrencyDataStatus = 'ready' | 'incomplete' | 'excluded';",
    'export interface CurrencyRecord {',
    '  /** ISO 4217 numeric code, three digits. */',
    '  readonly numeric: string;',
    '  /** ISO 4217 minor unit (decimal places of the minor unit); null when ISO says N.A. (not fiat). */',
    '  readonly minorUnit: number | null;',
    '  /** CLDR: fraction digits normally shown, and the rounding increment in those digits (0 = none). */',
    '  readonly digits: number;',
    '  readonly rounding: number;',
    '  /** CLDR: the same for cash (Swiss 0.05, Danish 0.50); presentation of cash only, never the ledger. */',
    '  readonly cashDigits: number;',
    '  readonly cashRounding: number;',
    '  readonly kind: CurrencyKind;',
    '  readonly status: CurrencyDataStatus;',
    '  /** What `status: incomplete` lacks: "name:<language>" (CLDR has no name in that language) or "tender"',
    '   * (no CLDR territory lists it as current legal tender). */',
    '  readonly missing: readonly string[];',
    '  /** CLDR root symbol, unique among fiat currencies ("US$", "CA$", "€", "JP¥"), or the code itself. */',
    '  readonly symbol: string;',
    '  /** CLDR narrow symbol ("$", "¥", "kr"): ambiguous on purpose, only for a region\'s own currency. */',
    '  readonly narrowSymbol: string;',
    '  /** ISO 3166 regions where CLDR lists it as current legal tender (search aliases, never a default). */',
    '  readonly territories: readonly string[];',
    '}',
    '',
    `export const ISO_4217_PUBLISHED = ${q(published)};`,
    `export const CLDR_VERSION = ${q(lock.cldr)};`,
    '',
    '/** Every code of ISO 4217 List One, sorted. */',
    'export const CURRENCY_CODES = [',
  ];
  for (let index = 0; index < records.length; index += 12) lines.push('  ' + records.slice(index, index + 12).map(record => q(record.code)).join(', ') + ',');
  lines.push('] as const;', 'export type IsoCurrencyCode = typeof CURRENCY_CODES[number];', '',
    'export const CURRENCY_DATA: { readonly [Code in IsoCurrencyCode]: CurrencyRecord } = {');
  for (const record of records) {
    const { code, ...fields } = record;
    lines.push(`  ${code}: { numeric: ${q(fields.numeric)}, minorUnit: ${fields.minorUnit}, digits: ${fields.digits}, rounding: ${fields.rounding}, cashDigits: ${fields.cashDigits}, cashRounding: ${fields.cashRounding}, kind: ${q(fields.kind)}, status: ${q(fields.status)}, missing: ${q(fields.missing)}, symbol: ${q(fields.symbol)}, narrowSymbol: ${q(fields.narrowSymbol)}, territories: ${q(fields.territories)} },`);
  }
  lines.push('};', '');
  return lines.join('\n');
}

function namesModule(lang, { published, records, names, territoryNames }, lock) {
  const used = new Set(records.filter(record => record.kind === 'fiat').flatMap(record => record.territories));
  const lines = [
    `/* GENERATED by apps/mobile/scripts/currency/generate.mjs (\`npm run currency:generate\`). Do not edit.`,
    ...HEADER_SOURCES(published, lock),
    ` * Currency names in "${lang}" from CLDR main/${lang}/currencies.json (display name, count-one and`,
    ` * count-other forms) for every fiat currency CLDR names, and the names of the territories where those`,
    ` * currencies are legal tender (main/${lang}/territories.json), for search. CLDR is the translation:`,
    ' * these names are data, not interface copy, and are never edited in the catalogue. */',
    "import type { CurrencyNames } from './types.ts';",
    '',
    `export const ${lang}: CurrencyNames = {`,
    '  currencies: {',
  ];
  for (const record of records.filter(item => item.kind === 'fiat')) {
    const cldr = names[lang][record.code];
    if (!cldr?.['displayName-count-other']) continue;
    const entry = { name: cldr.displayName, other: cldr['displayName-count-other'] };
    if (cldr['displayName-count-one']) entry.one = cldr['displayName-count-one'];
    lines.push(`    ${record.code}: { name: ${q(entry.name)}, one: ${q(entry.one ?? entry.other)}, other: ${q(entry.other)} },`);
  }
  lines.push('  },', '  territories: {');
  for (const region of [...used].sort()) {
    const name = territoryNames[lang][region];
    if (name) lines.push(`    ${region}: ${q(name)},`);
  }
  lines.push('  },', '};', '');
  return lines.join('\n');
}

/** Offline integrity of the committed catalogue against the lock: every generated output's sha256,
 * its GENERATED header, and the lock's agreement with this generator. Returns the problems found. */
export function verifyOutputs(langs, { root = ROOT, lockPath = LOCK } = {}) {
  const problems = [];
  if (!existsSync(lockPath)) return ['no sources.lock.json'];
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  if (lock.cldr !== CLDR_TAG) problems.push(`the lock names CLDR ${lock.cldr}, the generator ${CLDR_TAG}`);
  for (const source of sources(langs)) {
    const entry = lock.files?.[source.file];
    if (!entry || entry.url !== source.url || !/^[0-9a-f]{64}$/.test(entry.sha256 ?? '')) problems.push(`${source.file} is not in the lock with its URL and sha256`);
  }
  // Output paths are always repository-relative (as the lock records them); `root` only says where to read them.
  const expected = [relative(ROOT, DOMAIN_OUT), ...langs.map(lang => relative(ROOT, join(NAMES_DIR, `${lang}.ts`)))].sort();
  const recorded = Object.keys(lock.outputs ?? {}).sort();
  if (JSON.stringify(expected) !== JSON.stringify(recorded)) problems.push(`the lock records outputs [${recorded}] but this generator writes [${expected}]`);
  for (const path of expected) {
    const file = join(root, path);
    if (!existsSync(file)) { problems.push(`${path} is missing`); continue; }
    const buffer = readFileSync(file);
    if (!buffer.toString('utf8').startsWith('/* GENERATED by apps/mobile/scripts/currency/generate.mjs')) problems.push(`${path} lacks the GENERATED header`);
    if (lock.outputs?.[path] !== sha256(buffer)) problems.push(`${path} differs from the sha256 the lock recorded: it was edited by hand or the lock was not updated`);
  }
  return problems;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const langs = await languages();
  const list = sources(langs);
  if (args.has('--verify')) {
    const problems = verifyOutputs(langs);
    console.log(problems.length ? `Currency catalogue integrity failed:\n  ${problems.join('\n  ')}\nRun npm run currency:generate (with the cached sources) and commit its outputs.` : 'Currency catalogue integrity verified (offline).');
    process.exit(problems.length ? 1 : 0);
  }
  if (args.has('--download')) await download(list);
  const { files, lock } = readSources(list);
  const data = build(files, langs);
  const outputs = [[DOMAIN_OUT, domainModule(data, lock)], ...langs.map(lang => [join(NAMES_DIR, `${lang}.ts`), namesModule(lang, data, lock)])];
  // The lock also records each output's sha256, so CI (which has no cached sources) can still
  // prove that nobody edited a generated file by hand (tests/currency-catalogue.node.ts).
  const hashes = Object.fromEntries(outputs.map(([path, text]) => [relative(ROOT, path), sha256(Buffer.from(text, 'utf8'))]));
  if (args.has('--check')) {
    const stale = outputs.filter(([path, text]) => !existsSync(path) || readFileSync(path, 'utf8') !== text).map(([path]) => relative(ROOT, path));
    if (JSON.stringify(lock.outputs ?? {}) !== JSON.stringify(hashes)) stale.push(relative(ROOT, LOCK) + ' (output hashes)');
    console.log(stale.length ? `Stale generated files:\n  ${stale.join('\n  ')}\nRun npm run currency:generate.` : 'Currency catalogue up to date.');
    process.exit(stale.length ? 1 : 0);
  }
  mkdirSync(NAMES_DIR, { recursive: true });
  for (const [path, text] of outputs) writeFileSync(path, text);
  writeFileSync(LOCK, JSON.stringify({ ...lock, outputs: hashes }, null, 2) + '\n');
  const counts = data.records.reduce((acc, record) => ({ ...acc, [record.status]: (acc[record.status] ?? 0) + 1 }), {});
  console.log(`ISO 4217 ${data.published}, CLDR ${lock.cldr}: ${data.records.length} codes (${Object.entries(counts).map(([status, count]) => `${count} ${status}`).join(', ')}).`);
  for (const [path] of outputs) console.log('  wrote ' + relative(ROOT, path));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exit(1); });
}
