// npm run i18n:export -- <language> [--all]
// Writes i18n/work/<language>.json: one entry per key with the Spanish source,
// the English reference, the translator's context (the comment above the key),
// its placeholders, the plural categories the language needs, the glossary
// terms it contains and the current translation if any. By default only keys
// that are missing or stale for that language; --all exports everything.
// The file is the brief for AI-assisted translation or the upload to a
// translation platform. It is written locally only (i18n/work is ignored);
// nothing is sent anywhere. A person reviews the result before it becomes a
// catalogue module; then `npm run i18n:check -- --accept <language>`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOBILE, SOURCE_LANGUAGE, catalogueLanguages, contexts, flatten, hash, isPlural, loadCatalogue, placeholders, texts } from './lib.mjs';
import { requiredPlurals } from './check.mjs';

export async function exportLanguage(language, { all = false } = {}) {
  const source = flatten(await loadCatalogue(SOURCE_LANGUAGE));
  const english = flatten(await loadCatalogue('en'));
  const existing = catalogueLanguages().includes(language) ? flatten(await loadCatalogue(language)) : new Map();
  const lock = JSON.parse(readFileSync(join(MOBILE, 'i18n', 'translations.lock.json'), 'utf8'))[language] ?? {};
  const glossary = JSON.parse(readFileSync(join(MOBILE, 'i18n', 'glossary.json'), 'utf8')).terms;
  const notes = contexts();
  const entries = [];
  for (const [key, value] of source) {
    const current = existing.get(key);
    const stale = current !== undefined && lock[key] !== hash(value);
    if (!all && current !== undefined && !stale) continue;
    const text = texts(value).join(' ').toLowerCase();
    entries.push({
      key, source: value, english: english.get(key), current: current ?? null, stale,
      context: notes.get(key)?.text ?? null, module: notes.get(key)?.file ?? null,
      placeholders: placeholders(texts(value).join(' ')),
      plural: isPlural(value) ? requiredPlurals(language) : null,
      glossary: glossary.filter(term => text.includes(term.es.toLowerCase())).map(term => ({ es: term.es, en: term.en, note: term.note })),
    });
  }
  const brief = {
    language, generatedFrom: SOURCE_LANGUAGE, count: entries.length,
    instructions: 'Translate "source" (Argentine Spanish) into the target language for an iOS personal-finance app. Keep every {placeholder} exactly; '
      + 'give every plural category listed in "plural"; follow the glossary; keep labels about as short as the English reference; '
      + 'never translate user data examples such as merchant or account names; formal register only where the language requires it.',
    entries,
  };
  mkdirSync(join(MOBILE, 'i18n', 'work'), { recursive: true });
  const file = join(MOBILE, 'i18n', 'work', language + '.json');
  writeFileSync(file, JSON.stringify(brief, null, 2) + '\n');
  return { file, count: entries.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [language] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  if (!language || !/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(language)) { console.log('Usage: npm run i18n:export -- <language> [--all]'); process.exit(1); }
  const { file, count } = await exportLanguage(language, { all: process.argv.includes('--all') });
  console.log(`${count} key(s) written to ${file}`);
}
