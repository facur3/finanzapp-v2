// npm run i18n:check — validates every catalogue against the Spanish reference:
//   errors (exit 1): missing or extra keys, placeholders that differ, a plural
//     without a category its language uses for whole numbers, empty text;
//   stale (exit 1 with --strict): the Spanish text changed after the
//     translation was reviewed (i18n/translations.lock.json keeps the hash of
//     the Spanish text each translation was made from);
//   notes: text identical to Spanish (possibly untranslated).
// `npm run i18n:check -- --accept en` records the current Spanish hashes for
// English after a person reviewed the English changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOBILE, SOURCE_LANGUAGE, catalogueLanguages, flatten, hash, isPlural, loadCatalogue, placeholders, texts } from './lib.mjs';

const LOCK = join(MOBILE, 'i18n', 'translations.lock.json');

/** Categories a language actually uses for whole numbers 0–1000 (Spanish "many" is only for millions in compact notation). */
export function requiredPlurals(language) {
  try {
    const rule = new Intl.PluralRules(language);
    return [...new Set(Array.from({ length: 1001 }, (_, n) => rule.select(n)))].sort();
  } catch { return ['one', 'other']; }
}

export async function checkCatalogues({ strict = false } = {}) {
  const source = flatten(await loadCatalogue(SOURCE_LANGUAGE));
  const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
  const report = { errors: [], stale: [], notes: [] };
  for (const language of catalogueLanguages()) {
    const target = flatten(await loadCatalogue(language));
    const required = requiredPlurals(language);
    for (const [key, value] of source) {
      const translated = target.get(key);
      if (translated === undefined) { report.errors.push(`${language}: missing ${key}`); continue; }
      if (isPlural(value) !== isPlural(translated)) { report.errors.push(`${language}: ${key} must ${isPlural(value) ? '' : 'not '}be a plural`); continue; }
      if (texts(translated).some(text => !text.trim())) report.errors.push(`${language}: empty text at ${key}`);
      const expected = placeholders(texts(value).join(' ')).join(',');
      for (const text of texts(translated)) {
        const got = placeholders(text).join(',');
        const pluralCountOnly = isPlural(value) && got === expected.split(',').filter(name => name !== 'count').join(',');
        if (got !== expected && !pluralCountOnly) report.errors.push(`${language}: ${key} uses {${got}} but the source has {${expected}}: "${text}"`);
      }
      if (isPlural(translated)) {
        const missing = required.filter(category => !(category in translated));
        if (missing.length) report.errors.push(`${language}: ${key} lacks the plural categor${missing.length > 1 ? 'ies' : 'y'} ${missing.join(', ')}`);
      }
      if (language !== SOURCE_LANGUAGE) {
        const reviewed = lock[language]?.[key];
        if (reviewed && reviewed !== hash(value)) report.stale.push(`${language}: ${key} was translated from an older Spanish text`);
        if (!reviewed) report.stale.push(`${language}: ${key} has no reviewed source hash`);
        if (JSON.stringify(translated) === JSON.stringify(value) && /[a-záéíóúñ]{4,}/i.test(texts(value).join(' '))) report.notes.push(`${language}: ${key} is identical to Spanish`);
      }
    }
    for (const key of target.keys()) if (!source.has(key)) report.errors.push(`${language}: ${key} does not exist in Spanish`);
  }
  report.failed = report.errors.length > 0 || (strict && report.stale.length > 0);
  return report;
}

export async function acceptLanguage(language) {
  const source = flatten(await loadCatalogue(SOURCE_LANGUAGE));
  const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
  lock[language] = Object.fromEntries([...source].map(([key, value]) => [key, hash(value)]).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const accept = args.indexOf('--accept');
  if (accept >= 0) { await acceptLanguage(args[accept + 1]); console.log('Recorded the reviewed Spanish source for ' + args[accept + 1] + '.'); }
  const report = await checkCatalogues({ strict: args.includes('--strict') });
  for (const line of report.errors) console.log('ERROR  ' + line);
  for (const line of report.stale) console.log('STALE  ' + line);
  if (args.includes('--verbose')) for (const line of report.notes) console.log('NOTE   ' + line);
  console.log(`${catalogueLanguages().join(', ')}: ${report.errors.length} error(s), ${report.stale.length} stale, ${report.notes.length} note(s).`);
  process.exit(report.failed ? 1 : 0);
}
