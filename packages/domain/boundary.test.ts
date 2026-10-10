import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** AGENTS.md rule 7: the domain is pure and self-contained. Every source module (tests excluded) imports only sibling
 * modules of this package, by their exact `./name.ts` path (or `./name.js`, a plain-data module the server reads too,
 * which itself imports nothing): never React Native, Expo, storage, the server, the UI, a Node API or another package.
 * `scripts/check-repo.mjs` guards retired paths only; this test guards the package. */
const DIR = fileURLToPath(new URL('.', import.meta.url));
const SOURCES = readdirSync(DIR).filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts'));
const DATA_MODULES = readdirSync(DIR).filter(name => name.endsWith('.js'));

/** Static `import … from`, `export … from` and bare `import '…'` statements at the start of a line, across lines. */
function specifiers(text: string): string[] {
  const found = [...text.matchAll(/^\s*(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/gm)].map(match => match[1]);
  found.push(...[...text.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)].map(match => match[1]));
  return found;
}

describe('domain boundary', () => {
  it('lists the sources it checks', () => {
    expect(SOURCES).toContain('review-drafts.ts');
    expect(SOURCES).toContain('index.ts');
  });
  it.each(SOURCES)('%s imports only sibling modules of the package', source => {
    const text = readFileSync(join(DIR, source), 'utf8');
    for (const specifier of specifiers(text)) {
      expect(specifier, `${source} imports ${specifier}`).toMatch(/^\.\/[a-z0-9-]+\.(?:ts|js)$/);
      expect(existsSync(join(DIR, specifier.slice(2))), `${source} imports a missing ${specifier}`).toBe(true);
    }
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(/\b(?:require\s*\(|import\s*\()/.test(code), `${source} loads a module at run time`).toBe(false);
  });
  it.each(DATA_MODULES)('%s is plain data: it imports nothing', source => {
    expect(DATA_MODULES).toContain('ledger-currencies.js');
    const text = readFileSync(join(DIR, source), 'utf8');
    expect(specifiers(text)).toEqual([]);
    expect(/\b(?:require\s*\(|import\s*\()/.test(text)).toBe(false);
  });
  it('catches an import that reaches out', () => {
    expect(specifiers("import { x } from '../../apps/mobile/src/storage/database.ts';")).toEqual(['../../apps/mobile/src/storage/database.ts']);
    expect(specifiers("import {\n  a,\n  b,\n} from 'react-native';")).toEqual(['react-native']);
    expect(specifiers("export * from 'expo-crypto';\nimport 'node:fs';")).toEqual(['expo-crypto', 'node:fs']);
  });
});
