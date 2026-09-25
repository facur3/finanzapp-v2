// npm run regions:generate — builds FinanzApp's region catalogue from Unicode CLDR (cldr-json at
// the same pinned tag as the currency catalogue), deterministically, never by hand:
//   - which countries and territories exist (supplemental/territoryInfo.json: every ISO 3166-1
//     alpha-2 code CLDR describes, minus the macro and placeholder codes), their ISO 3166-1 alpha-3
//     and numeric codes (supplemental/codeMappings.json) for search;
//   - the CLDR locale whose conventions stand for each region (supplemental/likelySubtags.json,
//     "und-JP" → ja-Jpan-JP → the nearest directory in availableLocales.json);
//   - that locale's number symbols and grouping (main/<locale>/numbers.json, the latn numbering
//     system: FinanzApp writes Latin digits everywhere), its short numeric date and short time
//     patterns (main/<locale>/ca-gregorian.json), the first day of the week (supplemental/
//     weekData.json), and the region's current legal tender (supplemental/currencyData.json, as the
//     currency generator reads it) for the bare "$" rule;
//   - the territory names of every language FinanzApp carries (main/<lang>/territories.json).
// Outputs (committed, never edited by hand):
//   src/i18n/regions/data.ts        codes, ISO mappings, source locale, conventions, tender
//   src/i18n/regions/<language>.ts  territory names, for the chooser and its search
// Modes, as in scripts/currency/generate.mjs (docs/i18n.md §11a):
//   (default)   REGENERATE from the cache (i18n/work/region-sources, ignored by git), checked against
//               scripts/regions/sources.lock.json, and record each output's sha256 in the lock
//   --download  REFRESH the cache from the pinned URLs first (the only mode that needs the network)
//   --check     REGENERATE AND COMPARE, write nothing, exit 1 when a committed output is stale
//   --verify    INTEGRITY, OFFLINE: the committed outputs' sha256 against the lock, their headers,
//               the lock's agreement with this generator. What CI runs on a clean checkout.
// No dependency, no paid service. The data is under the Unicode License v3 (LICENSES/Unicode-3.0.txt).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MOBILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = join(MOBILE, '..', '..');
const CACHE = join(MOBILE, 'i18n', 'work', 'region-sources');
const LOCK = join(MOBILE, 'scripts', 'regions', 'sources.lock.json');
const OUT_DIR = join(MOBILE, 'src', 'i18n', 'regions');
const DATA_OUT = join(OUT_DIR, 'data.ts');

/** The pinned CLDR release: the currency catalogue's, so both catalogues describe one CLDR. */
export const CLDR_TAG = '48.2.0';
const CLDR_BASE = `https://raw.githubusercontent.com/unicode-org/cldr-json/${CLDR_TAG}/cldr-json`;

/** CLDR territory codes that are not a country or territory a person lives in: the world and its
 * groupings (numeric codes), the European Union and Eurozone, the United Nations, Outlying Oceania,
 * the pseudo-locale regions and "unknown". */
const NOT_A_PLACE = new Set(['EU', 'EZ', 'UN', 'QO', 'XA', 'XB', 'ZZ']);

const WEEKDAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

async function languages() {
  const locale = await import(pathToFileURL(join(MOBILE, 'src', 'i18n', 'locale.ts')).href);
  return { langs: [...locale.SUPPORTED_LANGUAGES].sort(), regions: locale.REGION_REGISTRY };
}
async function currencyCatalogue() {
  const data = await import(pathToFileURL(join(ROOT, 'packages', 'domain', 'currency-data.ts')).href);
  return { catalogue: data.CURRENCY_DATA, published: data.ISO_4217_PUBLISHED };
}

const SUPPLEMENTAL = ['likelySubtags', 'weekData', 'timeData', 'codeMappings', 'territoryInfo', 'currencyData'];

/** Conventions a released region writes on purpose against CLDR's preference, each with its reason (docs/i18n.md §11a).
 * The generator records what CLDR says; src/i18n/locale.ts keeps the deliberate value; anything else that disagrees stops it. */
export const DELIBERATE_DEVIATIONS = {
  AR: { hour12: 'FinanzApp writes a 24-hour clock in Argentina (Producto 23.1C1: everyday Argentine writing is 14:03 and iOS in es_AR shows 24 h); CLDR timeData prefers h.' },
};

/** The fixed sources: the supplemental files, the locale directory list and the territory names. */
function fixedSources(langs) {
  return [
    ...SUPPLEMENTAL.map(name => ({ file: `${name}.json`, url: `${CLDR_BASE}/cldr-core/supplemental/${name}.json` })),
    { file: 'availableLocales.json', url: `${CLDR_BASE}/cldr-core/availableLocales.json` },
    ...langs.map(lang => ({ file: `territories-${lang}.json`, url: `${CLDR_BASE}/cldr-localenames-full/main/${lang}/territories.json` })),
  ];
}
/** The per-locale sources, known only once the fixed ones are read. */
function localeSources(locales) {
  return locales.flatMap(locale => [
    { file: `numbers-${locale}.json`, url: `${CLDR_BASE}/cldr-numbers-full/main/${locale}/numbers.json` },
    { file: `ca-gregorian-${locale}.json`, url: `${CLDR_BASE}/cldr-dates-full/main/${locale}/ca-gregorian.json` },
  ]);
}

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const supplemental = (files, name) => JSON.parse(files[`${name}.json`]).supplemental[name];

/** The countries and territories the catalogue lists: CLDR's territoryInfo codes that are places. */
export function placeCodes(files) {
  return Object.keys(supplemental(files, 'territoryInfo')).filter(code => /^[A-Z]{2}$/.test(code) && !NOT_A_PLACE.has(code)).sort();
}

function hasDirectory(likely, available) {
  try { localeDirectory(likely, available); return true; } catch { return false; }
}

/** The cldr-json directory whose data stands for a likely locale ("ja-Jpan-JP" → "ja", "es-Latn-AR" → "es-AR", "zh-Hans-CN" → "zh-Hans"). */
export function localeDirectory(likely, available) {
  const [language, script, region] = likely.split('-');
  for (const candidate of [`${language}-${script}-${region}`, `${language}-${region}`, `${language}-${script}`, language]) {
    if (available.includes(candidate)) return candidate;
  }
  throw new Error(`No cldr-json directory for ${likely}.`);
}

/** Each region's likely language and the directory its conventions come from. */
export function regionLocales(files) {
  const likely = supplemental(files, 'likelySubtags');
  const available = JSON.parse(files['availableLocales.json']).availableLocales.full;
  const out = {};
  for (const code of placeCodes(files)) {
    // CLDR's "Add Likely Subtags": und-XX when listed; otherwise the bare und entry (en-Latn-US) with the
    // region put back, which is how CLDR itself resolves the regions whose likely language is English.
    const fallback = likely.und.replace(/-[A-Z]{2}$/, `-${code}`);
    const tag = likely[`und-${code}`] ?? fallback;
    // A likely language cldr-json carries no data for (Samoan in American Samoa) keeps its language and takes the
    // conventions of the region's English locale, the way CLDR's own root fallback does; never invented ones.
    const directory = hasDirectory(tag, available) ? localeDirectory(tag, available) : localeDirectory(fallback, available);
    out[code] = { language: tag.split('-')[0], sourceLocale: directory };
  }
  return out;
}

/** The letters of a CLDR date or time pattern outside quoted literals, in order. */
function patternLetters(pattern) {
  return pattern.replace(/'[^']*'/g, '').replace(/[^A-Za-z]/g, '');
}

/** The numeric order, the separator and the zero padding a short date pattern writes ("d/M/yy", "y/MM/dd", "dd.MM.yy", "yy. M. d."). */
export function parseDatePattern(pattern) {
  // Quoted literals and bidi controls (Arabic patterns carry U+200F around the separators) are not separators.
  const bare = pattern.replace(/'[^']*'/g, '').replace(/[\u200E\u200F\u061C]/g, '');
  const fields = [...bare.matchAll(/(y+|M+|d+)/g)].map(match => match[1]);
  const order = fields.map(field => field[0]).join('');
  if (!['dMy', 'Mdy', 'yMd'].includes(order)) throw new Error(`Date pattern "${pattern}" does not order day, month and year in a supported way.`);
  const between = /(?:y+|M+|d+)([^yMd]+)(?:y+|M+|d+)/.exec(bare)?.[1] ?? '/';
  const separator = between.trim()[0] ?? ' ';
  if (!'/.- '.includes(separator)) throw new Error(`Date pattern "${pattern}" uses an unexpected separator "${between}".`);
  return { dateOrder: order === 'dMy' ? 'dmy' : order === 'Mdy' ? 'mdy' : 'ymd', dateSeparator: separator,
    paddedDate: fields.some(field => field === 'MM' || field === 'dd') };
}

/** CLDR timeData's preferred hour cycle for a region: h and K are 12-hour, H and k 24-hour; null when unknown. */
export function preferredHour12(entry) {
  const preferred = entry?._preferred;
  return preferred === 'h' || preferred === 'K' ? true : preferred === 'H' || preferred === 'k' ? false : null;
}

/** Whether a short time pattern carries a day period (12-hour clock). */
export function parseTimePattern(pattern) {
  return /[abB]/.test(patternLetters(pattern));
}

/** The primary and secondary group sizes of a decimal pattern ("#,##0.###" → 3/3, "#,##,##0.###" → 3/2). */
export function parseGrouping(pattern) {
  const integer = pattern.split(';')[0].split('.')[0];
  const groups = integer.split(',');
  if (groups.length < 2) return { primaryGrouping: 3, secondaryGrouping: 3 };
  const primary = groups[groups.length - 1].length;
  const secondary = groups.length > 2 ? groups[groups.length - 2].length : primary;
  return { primaryGrouping: primary, secondaryGrouping: secondary };
}

/** A region's current legal tender on `day`, in CLDR's order; the currency generator's rule. */
export function currentTender(regionData, day) {
  const onDay = (date, when) => String(date).slice(0, 10) <= when;
  const codes = [];
  for (const item of regionData ?? []) for (const [code, info] of Object.entries(item)) {
    if (info._tender === 'false' || (info._from && !onDay(info._from, day)) || (info._to && onDay(info._to, day))) continue;
    codes.push(code);
  }
  return codes;
}

export function build(files, langs, { catalogue: currencyData, published }, handWritten = {}) {
  const locales = regionLocales(files);
  const week = supplemental(files, 'weekData');
  const time = supplemental(files, 'timeData');
  const mappings = supplemental(files, 'codeMappings');
  const tenderByRegion = supplemental(files, 'currencyData').region;
  const names = Object.fromEntries(langs.map(lang => [lang, JSON.parse(files[`territories-${lang}.json`]).main[lang].localeDisplayNames.territories]));
  // The day the tender is read on is fixed by the data, not by the clock: the currency catalogue's ISO publication
  // date, the same day its territories were computed, so both catalogues agree on what is tender where.
  const day = published;
  const records = [];
  for (const [code, { language, sourceLocale }] of Object.entries(locales)) {
    const numbers = JSON.parse(files[`numbers-${sourceLocale}.json`]).main[sourceLocale].numbers;
    const gregorian = JSON.parse(files[`ca-gregorian-${sourceLocale}.json`]).main[sourceLocale].dates.calendars.gregorian;
    const symbols = numbers['symbols-numberSystem-latn'];
    if (!symbols?.decimal || !symbols?.group) throw new Error(`${sourceLocale}: no latn symbols.`);
    const grouping = parseGrouping(numbers['decimalFormats-numberSystem-latn'].standard);
    const date = parseDatePattern(gregorian.dateFormats.short);
    const tender = currentTender(tenderByRegion[code], day);
    const dollar = tender.find(currency => currencyData[currency]?.narrowSymbol === '$') ?? null;
    const mapping = mappings[code] ?? {};
    for (const lang of langs) if (!names[lang][code]) throw new Error(`${code} has no name in ${lang}.`);
    records.push({
      code, alpha3: mapping._alpha3 ?? null, numeric: mapping._numeric ?? null, language, sourceLocale,
      decimal: symbols.decimal, group: symbols.group, ...grouping,
      minimumGroupingDigits: Number(numbers.minimumGroupingDigits ?? 1),
      // The clock is a property of the region in CLDR (timeData: the preferred hour cycle), the pattern only a fallback.
      ...date, hour12: preferredHour12(time[code] ?? time['001']) ?? parseTimePattern(gregorian.timeFormats.short),
      weekStart: WEEKDAY_INDEX[week.firstDay[code] ?? week.firstDay['001']],
      currencies: tender, dollarSignCurrency: dollar,
    });
  }
  // The hand-written conventions of the released regions (src/i18n/locale.ts) must be exactly what CLDR says, so the
  // catalogue can replace them one day without changing one string; a disagreement stops the generator.
  for (const [code, expected] of Object.entries(handWritten)) {
    const record = records.find(item => item.code === code);
    if (!record) throw new Error(`${code} is in REGIONS but not in the catalogue.`);
    const differences = Object.entries(expected).filter(([key, value]) => record[key] !== value && !DELIBERATE_DEVIATIONS[code]?.[key])
      .map(([key, value]) => `${key}: CLDR ${JSON.stringify(record[key])}, REGIONS ${JSON.stringify(value)}`);
    if (differences.length) throw new Error(`${code}: the catalogue disagrees with REGIONS (${differences.join('; ')}); a deliberate deviation must be listed in DELIBERATE_DEVIATIONS with its reason.`);
  }
  return { records, names, day };
}

const q = value => JSON.stringify(value);
const HEADER = (lock) => [
  ` * Source: Unicode CLDR ${lock.cldr} (cldr-json; data under the Unicode License v3, LICENSES/Unicode-3.0.txt).`,
  ' * Exact files and sha256: apps/mobile/scripts/regions/sources.lock.json. How to update: docs/i18n.md §11a.',
];

function dataModule({ records, day }, lock) {
  const lines = [
    '/* GENERATED by apps/mobile/scripts/regions/generate.mjs (`npm run regions:generate`). Do not edit.',
    ...HEADER(lock),
    ' * One record per country or territory CLDR describes (its territoryInfo, minus the macro and placeholder',
    ' * codes): the ISO 3166-1 codes, the CLDR locale whose conventions stand for the region (likelySubtags),',
    ' * the number symbols and grouping of that locale (Latin digits), the order, separator and padding of its',
    ' * short numeric date, its clock, the first day of the week and the current legal tender. This file is data;',
    ' * src/i18n/regions.ts is the API and src/i18n/locale.ts decides which regions this build honours. */',
    '',
    "export type DateOrder = 'dmy' | 'mdy' | 'ymd';",
    'export interface RegionRecord {',
    '  /** ISO 3166-1 alpha-3 and numeric codes (search aliases); null when CLDR maps none. */',
    '  readonly alpha3: string | null;',
    '  readonly numeric: string | null;',
    '  /** The language CLDR considers most likely in the region, and the cldr-json directory the conventions come from. */',
    '  readonly language: string;',
    '  readonly sourceLocale: string;',
    '  /** Decimal and grouping separators for Latin digits. */',
    '  readonly decimal: string;',
    '  readonly group: string;',
    '  /** Digits in the last group and in the groups before it (3/3 almost everywhere, 3/2 for lakh and crore). */',
    '  readonly primaryGrouping: number;',
    '  readonly secondaryGrouping: number;',
    '  /** Whole digits needed before the first group separator appears (2 where "1000" is written unbroken). */',
    '  readonly minimumGroupingDigits: number;',
    '  /** The short numeric date: its field order, the separator between fields and whether day and month are zero-padded. */',
    '  readonly dateOrder: DateOrder;',
    '  readonly dateSeparator: string;',
    '  readonly paddedDate: boolean;',
    '  /** A 12-hour clock with a day period. */',
    '  readonly hour12: boolean;',
    '  /** First day of the week, 0 = Sunday … 6 = Saturday. */',
    '  readonly weekStart: number;',
    `  /** Current legal tender on ${day}, in CLDR's order (search aliases and the bare "$" rule; never a default for an account). */`,
    '  readonly currencies: readonly string[];',
    '  /** The tender whose narrow symbol is "$", which a bare "$" names in the region; null where no such currency is tender. */',
    '  readonly dollarSignCurrency: string | null;',
    '}',
    '',
    `export const CLDR_REGIONS_VERSION = ${q(lock.cldr)};`,
    '',
    '/** Every country and territory of the catalogue, sorted by code. */',
    'export const REGION_CODES = [',
  ];
  for (let index = 0; index < records.length; index += 16) lines.push('  ' + records.slice(index, index + 16).map(record => q(record.code)).join(', ') + ',');
  lines.push('] as const;', 'export type CatalogueRegionCode = typeof REGION_CODES[number];', '',
    'export const REGION_DATA: { readonly [Code in CatalogueRegionCode]: RegionRecord } = {');
  for (const record of records) {
    const { code, ...fields } = record;
    lines.push(`  ${code}: { alpha3: ${q(fields.alpha3)}, numeric: ${q(fields.numeric)}, language: ${q(fields.language)}, sourceLocale: ${q(fields.sourceLocale)}, decimal: ${q(fields.decimal)}, group: ${q(fields.group)}, primaryGrouping: ${fields.primaryGrouping}, secondaryGrouping: ${fields.secondaryGrouping}, minimumGroupingDigits: ${fields.minimumGroupingDigits}, dateOrder: ${q(fields.dateOrder)}, dateSeparator: ${q(fields.dateSeparator)}, paddedDate: ${fields.paddedDate}, hour12: ${fields.hour12}, weekStart: ${fields.weekStart}, currencies: ${q(fields.currencies)}, dollarSignCurrency: ${q(fields.dollarSignCurrency)} },`);
  }
  lines.push('};', '');
  return lines.join('\n');
}

function namesModule(lang, { records, names }, lock) {
  const lines = [
    '/* GENERATED by apps/mobile/scripts/regions/generate.mjs (`npm run regions:generate`). Do not edit.',
    ...HEADER(lock),
    ` * The name of every catalogue region in "${lang}", from CLDR main/${lang}/territories.json. CLDR is the`,
    ' * translation: these names are data, not interface copy, and are never edited in the catalogue. */',
    "import type { RegionNames } from './types.ts';",
    '',
    `export const ${lang}: RegionNames = {`,
  ];
  for (const record of records) lines.push(`  ${record.code}: ${q(names[lang][record.code])},`);
  lines.push('};', '');
  return lines.join('\n');
}

async function fetchInto(list, lock) {
  mkdirSync(CACHE, { recursive: true });
  let index = 0;
  const worker = async () => {
    while (index < list.length) {
      const source = list[index++];
      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`${source.url}: HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(join(CACHE, source.file), buffer);
      lock.files[source.file] = { url: source.url, sha256: sha256(buffer), bytes: buffer.length, retrieved: new Date().toISOString().slice(0, 10) };
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

async function download(langs) {
  const previous = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : null;
  const lock = { about: 'Sources of the region catalogue: URL, sha256 and size of the exact bytes the committed data was generated from. Updated only by `npm run regions:generate -- --download`.', cldr: CLDR_TAG, files: {} };
  const fixed = fixedSources(langs);
  await fetchInto(fixed, lock);
  const files = Object.fromEntries(fixed.map(source => [source.file, readFileSync(join(CACHE, source.file), 'utf8')]));
  const locales = [...new Set(Object.values(regionLocales(files)).map(item => item.sourceLocale))].sort();
  await fetchInto(localeSources(locales), lock);
  for (const [file, entry] of Object.entries(lock.files)) {
    const old = previous?.files?.[file];
    if (old && old.sha256 === entry.sha256) entry.retrieved = old.retrieved;
  }
  lock.files = Object.fromEntries(Object.entries(lock.files).sort(([a], [b]) => a.localeCompare(b, 'en')));
  if (previous?.outputs) lock.outputs = previous.outputs;
  writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
}

function readSources(langs) {
  if (!existsSync(LOCK)) throw new Error('No sources.lock.json: run `npm run regions:generate -- --download` first.');
  const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
  if (lock.cldr !== CLDR_TAG) throw new Error(`The lock names CLDR ${lock.cldr}, the generator ${CLDR_TAG}: run with --download.`);
  const read = source => {
    const path = join(CACHE, source.file), entry = lock.files[source.file];
    if (!entry || entry.url !== source.url) throw new Error(`${source.file} is not in the lock with ${source.url}: run with --download.`);
    if (!existsSync(path)) throw new Error(`${relative(MOBILE, path)} is missing: run with --download.`);
    const buffer = readFileSync(path);
    if (sha256(buffer) !== entry.sha256) throw new Error(`${source.file} differs from the lock (sha256): run with --download and review the diff.`);
    return buffer.toString('utf8');
  };
  const files = {};
  for (const source of fixedSources(langs)) files[source.file] = read(source);
  const locales = [...new Set(Object.values(regionLocales(files)).map(item => item.sourceLocale))].sort();
  for (const source of localeSources(locales)) files[source.file] = read(source);
  return { files, lock };
}

/** Offline integrity of the committed catalogue against the lock. Returns the problems found. */
export function verifyOutputs(langs, { root = ROOT, lockPath = LOCK } = {}) {
  const problems = [];
  if (!existsSync(lockPath)) return ['no sources.lock.json'];
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  if (lock.cldr !== CLDR_TAG) problems.push(`the lock names CLDR ${lock.cldr}, the generator ${CLDR_TAG}`);
  for (const source of fixedSources(langs)) {
    const entry = lock.files?.[source.file];
    if (!entry || entry.url !== source.url || !/^[0-9a-f]{64}$/.test(entry.sha256 ?? '')) problems.push(`${source.file} is not in the lock with its URL and sha256`);
  }
  for (const [file, entry] of Object.entries(lock.files ?? {})) {
    if (!entry.url?.startsWith(CLDR_BASE + '/')) problems.push(`${file} is not from the pinned CLDR release`);
  }
  const expected = [relative(ROOT, DATA_OUT), ...langs.map(lang => relative(ROOT, join(OUT_DIR, `${lang}.ts`)))].sort();
  const recorded = Object.keys(lock.outputs ?? {}).sort();
  if (JSON.stringify(expected) !== JSON.stringify(recorded)) problems.push(`the lock records outputs [${recorded}] but this generator writes [${expected}]`);
  for (const path of expected) {
    const file = join(root, path);
    if (!existsSync(file)) { problems.push(`${path} is missing`); continue; }
    const buffer = readFileSync(file);
    if (!buffer.toString('utf8').startsWith('/* GENERATED by apps/mobile/scripts/regions/generate.mjs')) problems.push(`${path} lacks the GENERATED header`);
    if (lock.outputs?.[path] !== sha256(buffer)) problems.push(`${path} differs from the sha256 the lock recorded: it was edited by hand or the lock was not updated`);
  }
  return problems;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const { langs, regions } = await languages();
  if (args.has('--verify')) {
    const problems = verifyOutputs(langs);
    console.log(problems.length ? `Region catalogue integrity failed:\n  ${problems.join('\n  ')}\nRun npm run regions:generate (with the cached sources) and commit its outputs.` : 'Region catalogue integrity verified (offline).');
    process.exit(problems.length ? 1 : 0);
  }
  if (args.has('--download')) await download(langs);
  const { files, lock } = readSources(langs);
  const currencies = await currencyCatalogue();
  // The released regions' hand-written conventions, in the catalogue's field names.
  const handWritten = Object.fromEntries(Object.entries(regions).map(([code, conventions]) => [code, {
    decimal: conventions.decimal, group: conventions.group, dateOrder: conventions.dateOrder, hour12: conventions.hour12, dollarSignCurrency: conventions.dollarSignCurrency }]));
  const data = build(files, langs, currencies, handWritten);
  const outputs = [[DATA_OUT, dataModule(data, lock)], ...langs.map(lang => [join(OUT_DIR, `${lang}.ts`), namesModule(lang, data, lock)])];
  const hashes = Object.fromEntries(outputs.map(([path, text]) => [relative(ROOT, path), sha256(Buffer.from(text, 'utf8'))]));
  if (args.has('--check')) {
    const stale = outputs.filter(([path, text]) => !existsSync(path) || readFileSync(path, 'utf8') !== text).map(([path]) => relative(ROOT, path));
    if (JSON.stringify(lock.outputs ?? {}) !== JSON.stringify(hashes)) stale.push(relative(ROOT, LOCK) + ' (output hashes)');
    console.log(stale.length ? `Stale generated files:\n  ${stale.join('\n  ')}\nRun npm run regions:generate.` : 'Region catalogue up to date.');
    process.exit(stale.length ? 1 : 0);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [path, text] of outputs) writeFileSync(path, text);
  lock.outputs = hashes;
  writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
  console.log(`Region catalogue generated: ${data.records.length} regions, ${langs.length} languages.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => { console.error(error.message); process.exit(1); });
}
