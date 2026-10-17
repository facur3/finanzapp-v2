import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LICENSE_NOTICES, licenseNotice } from '../src/ui/licenses.ts';

// Producto 25N1: Ajustes › Licencias shows what the binary ships, and each text is the one its source published. Compared
// with whitespace collapsed: the screen keeps paragraphs, the files wrap at 80 columns.
const flat = (text: string) => text.replace(/\s+/g, ' ').trim();
const shown = (id: string) => flat(licenseNotice(id)!.paragraphs.join('\n\n'));
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const pkg = JSON.parse(read('../package.json')) as { dependencies: Record<string, string> };
/** In-repository code under the repository's own terms, and the shim that only re-exports its MIT dependency. */
const OWN = new Set(['@finanzapp/domain', 'decode-uri-component']);

test('25N1: every production dependency is covered by exactly one notice, and every package a notice names is a dependency', () => {
  const covered = LICENSE_NOTICES.flatMap(notice => notice.packages);
  assert.equal(new Set(covered).size, covered.length, 'no package under two notices');
  const shipped = Object.keys(pkg.dependencies).filter(name => !OWN.has(name)).sort();
  assert.deepEqual([...covered].sort(), shipped, 'a new dependency needs its notice (src/ui/licenses.ts)');
  assert.equal(new Set(LICENSE_NOTICES.map(notice => notice.id)).size, LICENSE_NOTICES.length, 'one route id per notice');
});

test('25N1: each package\'s published LICENSE file is its notice\'s text; a package without one declares the notice\'s licence', () => {
  for (const notice of LICENSE_NOTICES) for (const name of notice.packages) {
    const folder = new URL('../node_modules/' + name + '/', import.meta.url);
    const file = readdirSync(folder).find(item => /^licen[cs]e/i.test(item));
    if (file) assert.equal(flat(readFileSync(new URL(file, folder), 'utf8')), shown(notice.id), name + ' → ' + notice.id);
    else assert.equal(JSON.parse(readFileSync(new URL('package.json', folder), 'utf8')).license, notice.licence, name + ' declares ' + notice.licence);
  }
});

test('25N1: the data notices are the texts the repository already ships: CLDR\'s Unicode License v3 and circle-flags\' MIT header', () => {
  assert.equal(shown('cldr'), flat(read('../../../LICENSES/Unicode-3.0.txt')));
  // The generated flag module carries circle-flags' licence in its header comment (stripped from the bundle, hence the screen).
  const header = read('../src/i18n/flag-art.ts').split('*/')[0];
  const licence = header.slice(header.indexOf('MIT License')).replace(/^\s*\*\s?/gm, '');
  assert.equal(flat(licence), shown('circle-flags'));
  for (const generated of ['../src/i18n/regions/data.ts', '../src/i18n/currencies/es.ts']) assert.match(read(generated), /Unicode License v3/, generated + ' is CLDR data');
  // The only icon font the app loads is Ionicons (app/_layout.tsx), embedded by @expo/vector-icons.
  assert.match(read('../app/_layout.tsx'), /useFonts\(Ionicons\.font\)/);
  assert.ok(existsSync(new URL('../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf', import.meta.url)));
  assert.equal(licenseNotice('ionicons')!.licence, 'MIT');
});
