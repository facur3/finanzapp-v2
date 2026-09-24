// Shared helpers for the local i18n tools (check, extract, export, pseudo).
// Run with Node ≥ 22.6 and --experimental-strip-types so the TypeScript
// catalogues load as they are. No network, no dependency, no paid service.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MOBILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MESSAGES = join(MOBILE, 'src', 'i18n', 'messages');
export const SOURCE_LANGUAGE = 'es';

/** Every language folder under messages/ (es, en, and any added later). */
export function catalogueLanguages() {
  return readdirSync(MESSAGES).filter(name => statSync(join(MESSAGES, name)).isDirectory()).sort();
}

export async function loadCatalogue(language) {
  const module = await import(pathToFileURL(join(MESSAGES, language, 'index.ts')).href);
  return module[language] ?? Object.values(module)[0];
}

const CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
/** Same rule as isPluralEntry in src/i18n/messages.ts: only CLDR category keys, all strings, `other` among them. */
export const isPlural = value => !!value && typeof value === 'object' && typeof value.other === 'string'
  && Object.entries(value).every(([key, text]) => CATEGORIES.has(key) && typeof text === 'string');

/** key → string | plural object, flattened with dotted keys. */
export function flatten(catalogue, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(catalogue)) {
    if (typeof value === 'string' || isPlural(value)) out.set(prefix + key, value);
    else flatten(value, prefix + key + '.', out);
  }
  return out;
}

export const texts = value => typeof value === 'string' ? [value] : Object.values(value);
export const placeholders = text => [...new Set([...text.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(match => match[1]))].sort();
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);

/** CLDR plural categories a language needs, from Node's ICU. */
export function pluralCategories(language) {
  try { return new Intl.PluralRules(language).resolvedOptions().pluralCategories; } catch { return ['one', 'other']; }
}

/** The `/** … *\/` comment written above each key in the Spanish modules: the translator's context. */
export function contexts() {
  const result = new Map();
  const dir = join(MESSAGES, SOURCE_LANGUAGE);
  for (const file of readdirSync(dir).filter(name => name.endsWith('.ts') && name !== 'index.ts')) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');
    const path = [];
    let comment = [];
    let collecting = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('/**')) { collecting = !trimmed.endsWith('*/'); comment = [trimmed]; continue; }
      if (collecting) { comment.push(trimmed); if (trimmed.endsWith('*/')) collecting = false; continue; }
      const depth = Math.max(0, (line.match(/^ */)[0].length / 2) - 1);
      const open = /^\s*([a-zA-Z0-9_]+): \{\s*$/.exec(line);
      const leaf = /^\s*([a-zA-Z0-9_]+): (?:'|\{ one)/.exec(line);
      if (open || leaf) {
        path.length = depth;
        const name = (open ?? leaf)[1];
        if (comment.length) {
          const text = comment.join(' ').replace(/^\/\*\*\s*/, '').replace(/\s*\*\/$/, '').replace(/\s*\*\s+/g, ' ').trim();
          result.set([...path, name].join('.'), { file: 'src/i18n/messages/es/' + file, text });
        }
        if (open) path[depth] = name;
        comment = [];
      } else if (trimmed && !trimmed.startsWith('*')) comment = [];
    }
  }
  return result;
}

export function sourceFiles(...dirs) {
  const walk = dir => readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
  return dirs.flatMap(dir => walk(join(MOBILE, dir))).map(path => relative(MOBILE, path));
}
