// npm run i18n:extract — finds visible copy written directly in screens and
// components instead of the catalogue, so a new string is caught without
// searching every screen by hand. Exits 1 when something is found.
// Deliberate exceptions live in i18n/extract-allow.json (file → reason);
// keep that list short and explain each entry.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOBILE, sourceFiles } from './lib.mjs';

/** A capitalised Spanish word opening a string literal, JSX text between tags, or a literal label/title/detail/placeholder/VoiceOver attribute. */
export const LITERAL = /(['"`][A-ZÁÉÍÓÚ¿¡][a-záéíóúñ]+[ ,.:'"`])|(>[^<>{}=;:?()]*[a-záéíóúñ]{3,}[^<>{}=;:?()]*<)|((label|title|detail|placeholder|accessibilityLabel|accessibilityHint)="[^"]*[a-zA-Z][^"]*")/;

export function findLiterals() {
  const allow = JSON.parse(readFileSync(join(MOBILE, 'i18n', 'extract-allow.json'), 'utf8'));
  const found = [];
  for (const file of sourceFiles('app', 'src')) {
    if (file.startsWith('src/i18n/messages/') || file in allow.files) continue;
    readFileSync(join(MOBILE, file), 'utf8').split('\n').forEach((line, index) => {
      if (line.includes('i18n-ignore')) return;
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*(\/?\*+).*$/, '');
      if (LITERAL.test(code)) found.push({ file, line: index + 1, text: line.trim() });
    });
  }
  return found;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const found = findLiterals();
  for (const item of found) console.log(`${item.file}:${item.line}  ${item.text.slice(0, 140)}`);
  console.log(found.length ? `\n${found.length} line(s) with copy outside the catalogue. Move them to src/i18n/messages or justify them in i18n/extract-allow.json.` : 'No copy outside the catalogue.');
  process.exit(found.length ? 1 : 0);
}
