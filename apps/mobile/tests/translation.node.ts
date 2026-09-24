import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as domain from '@finanzapp/domain';
import { CATEGORY_PRESETS, categoryKey, labelFromISO, newCategoryDefinition, editedCategoryDefinition, resolveCategory, validateEntry, validateTransfer } from '@finanzapp/domain';
import { es } from '../src/i18n/messages/es.ts';
import { en } from '../src/i18n/messages/en.ts';
import { messageKeys, translate } from '../src/i18n/messages.ts';
import { localizeError } from '../src/i18n/errors.ts';
import { relativeDate } from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { RELEASED_LANGUAGES } from '../src/i18n/locale.ts';
import { localizeCategory, localizedCategoryLabel } from '../src/ui/appearance.ts';
import { categoryChoices, categorySearchText, customCategory } from '../src/ui/categories.ts';
import { categoriesStatus } from '../src/ui/budget-presentation.ts';
import { accountKindLabel } from '../src/ui/liability-presentation.ts';
import { selectEntries, selectTransfers } from '../src/ui/presentation.ts';
import { translator } from '../src/i18n/messages.ts';

// Producto 23.1B1: navigation, Inicio, Movimientos, the main forms and the
// shared components read every visible string from the catalogues. English is
// complete for these screens and still unreleased.

const root = new URL('..', import.meta.url).pathname;
const read = (file: string) => readFileSync(join(root, file), 'utf8');
const leaf = (catalogue: object, key: string): unknown => key.split('.').reduce<any>((node, part) => node?.[part], catalogue);
const isPlural = (value: unknown): value is { one: string; other: string } => !!value && typeof value === 'object' && 'one' in value;

/** Every screen and module this delivery moved to the catalogue. */
const B1_FILES = [
  'app/_layout.tsx', 'app/(tabs)/_layout.tsx', 'app/(tabs)/index.tsx', 'app/(tabs)/activity.tsx', 'app/entry/[id].tsx', 'app/transfer/[id].tsx',
  'app/spending-detail.tsx', 'app/new-entry.tsx', 'app/new-transfer.tsx', 'app/edit-entry/[id].tsx', 'app/edit-transfer/[id].tsx', 'app/undone-entries.tsx',
  'src/ui/home-modules.tsx', 'src/ui/quick-actions.tsx', 'src/ui/entry-list.tsx', 'src/ui/movement-form.tsx', 'src/ui/entry-form.tsx',
  'src/ui/transfer-form.tsx', 'src/ui/form-controls.tsx', 'src/ui/components.tsx',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap(name => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

test('English stays unreleased until 23.1B2 and 23.1C are complete', () => {
  assert.deepEqual([...RELEASED_LANGUAGES], ['es']);
});

test('no screen of this delivery keeps a hard-coded Spanish label, title, placeholder or VoiceOver string', () => {
  // A capitalised Spanish word opening a string literal, JSX text between tags, or a literal label/title/detail/placeholder attribute.
  const literal = /(['"`][A-ZÁÉÍÓÚ¿¡][a-záéíóúñ]+[ ,.:'"`])|(>[^<>{}=;:?()]*[a-záéíóúñ]{3,}[^<>{}=;:?()]*<)|((label|title|detail|placeholder|accessibilityLabel|accessibilityHint)="[^"]*[a-zA-Z][^"]*")/;
  for (const file of B1_FILES) {
    read(file).split('\n').forEach((line, index) => {
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*(\/?\*+).*$/, '');
      assert.ok(!literal.test(code), `${file}:${index + 1} still has visible copy outside the catalogue: ${line.trim()}`);
    });
  }
});

test('every key the code asks for exists, and a key called without values has no placeholder to fill', () => {
  const keys = new Set(messageKeys(es));
  const call = /\b(?:t|tr)\(\s*'([a-zA-Z0-9.]+)'\s*(\))?/g;
  let checked = 0;
  for (const file of sourceFiles('app').concat(sourceFiles('src'))) {
    for (const match of read(file).matchAll(call)) {
      const [, key, closed] = match;
      if (!key.includes('.')) continue;
      checked++;
      assert.ok(keys.has(key), `${file} asks for a key that does not exist: ${key}`);
      if (closed) for (const catalogue of [es, en]) {
        const value = leaf(catalogue, key);
        const text = isPlural(value) ? value.other : String(value);
        assert.ok(!/\{[a-zA-Z0-9_]+\}/.test(text), `${file} calls ${key} without the values its placeholders need`);
      }
    }
  }
  assert.ok(checked > 150, 'the scan found the translated screens (' + checked + ' calls)');
});

test('both catalogues are complete: no empty text, and English is really English', () => {
  const keys = messageKeys(es);
  assert.deepEqual(messageKeys(en), keys);
  // Identical in both languages on purpose: proper names, format-only templates and the one-word English plural.
  const same = new Set(['preferences.regionNames.AR', 'preferences.regionSample', 'transferForm.figure', 'selection.category']);
  for (const key of keys) {
    for (const catalogue of [es, en]) {
      const value = leaf(catalogue, key);
      for (const text of isPlural(value) ? [value.one, value.other] : [value as string]) assert.ok(text.trim().length > 0, 'empty text at ' + key);
    }
    const a = JSON.stringify(leaf(es, key)), b = JSON.stringify(leaf(en, key));
    if (a === b && !same.has(key) && /[a-záéíóúñ]{4,}/i.test(a) && !/^"\{/.test(a)) assert.fail('untranslated English text at ' + key + ': ' + b);
  }
});

test('plurals pick one for exactly one and other for everything else, in both languages', () => {
  const plurals = messageKeys(es).filter(key => isPlural(leaf(es, key)));
  assert.ok(plurals.length >= 9, 'counts, accounts, categories, days and budget states are plurals: ' + plurals.join(', '));
  for (const key of plurals) for (const language of ['es', 'en'] as const) {
    const forms = leaf(language === 'es' ? es : en, key) as { one: string; other: string };
    assert.ok(forms.one.includes('{count}') && forms.other.includes('{count}'), key + ' shows its number');
    assert.equal(translate(language, key as never, { count: 1 }), forms.one.replace('{count}', '1'));
    for (const count of [0, 2, 21, 1000]) assert.equal(translate(language, key as never, { count }), forms.other.replace('{count}', String(count)));
  }
  assert.equal(translate('es', 'count.movements', { count: 1 }), '1 movimiento');
  assert.equal(translate('en', 'count.movements', { count: 0 }), '0 transactions');
  assert.equal(translate('en', 'home.upcomingRow.inDays', { count: 1 }), 'In 1 day');
  assert.equal(categoriesStatus(2, 0), '2 categorías en orden', 'Spanish output unchanged');
  assert.equal(categoriesStatus(3, 1), '1 categoría excedida');
  assert.equal(categoriesStatus(1, 0, translator('en')), '1 category on track');
  assert.equal(categoriesStatus(0, 0, translator('en')), '');
});

test('placeholders are filled with the values given; a missing value stays visible instead of blank', () => {
  assert.equal(translate('en', 'transferForm.after', { name: 'Caja' }), 'Caja afterwards');
  assert.equal(translate('es', 'home.budget.of', { amount: '$ 100,00', percent: 42 }), 'de $ 100,00 · 42 %');
  assert.equal(translate('en', 'home.budget.of', { amount: '$ 100,00', percent: 42 }), 'of $ 100,00 · 42%');
  assert.equal(translate('en', 'rows.transferLabel', { title: 'Transfer', from: 'A' }), 'Transfer, from A to {to}, {amount}, {date}');
});

test('errors: a stored key and a known thrown message read in the interface language; anything else is shown as thrown', () => {
  assert.equal(localizeError('en', 'entryForm.futureDate'), en.entryForm.futureDate);
  assert.equal(localizeError('es', 'entryForm.futureDate'), es.entryForm.futureDate);
  assert.equal(localizeError('en', 'Elegí dos cuentas distintas.'), 'Choose two different accounts.');
  assert.equal(localizeError('es', 'Elegí dos cuentas distintas.'), 'Elegí dos cuentas distintas.', 'Spanish output is the thrown message itself');
  assert.equal(localizeError('en', 'Un mensaje de 23.1B2.'), 'Un mensaje de 23.1B2.', 'an untranslated message is never lost');
  assert.equal(localizeError('en', 'no.such.key'), 'no.such.key');
  assert.equal(localizeError('en', ''), '');
  const account: domain.Account = { id: 'a', name: 'Caja', currency: 'ARS', openingMinor: 0, createdAt: '2026-01-01T12:00:00Z' };
  const messageOf = (run: () => void) => { try { run(); } catch (cause) { return (cause as Error).message; } return ''; };
  const zero = messageOf(() => validateEntry({ id: 'e', accountId: 'a', kind: 'expense', amountMinor: 0, merchant: 'x', category: 'y', dateISO: '2026-01-01', createdAt: account.createdAt }, [account]));
  const same = messageOf(() => validateTransfer({ id: 't', fromAccountId: 'a', toAccountId: 'a', amountMinor: 1, note: '', dateISO: '2026-01-01', createdAt: account.createdAt }, [account]));
  const unparsable = messageOf(() => domain.parseMinorUnits('abc'));
  for (const message of [zero, same, unparsable]) assert.notEqual(localizeError('en', message), message, 'the domain still throws the catalogued text: ' + message);
});

test('every catalogued error is still thrown verbatim by the domain or the storage layer', () => {
  const sources = [...readdirSync(join(root, '../../packages/domain')).filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts')).map(name => '../../packages/domain/' + name),
    ...sourceFiles('src/storage')].map(read).join('\n');
  for (const [group, messages] of Object.entries(es.errors)) for (const [name, text] of Object.entries(messages)) {
    assert.ok(sources.includes(`'${text}'`), `errors.${group}.${name} is no longer thrown as written; update the catalogue with the source`);
  }
});

test('built-in categories: localized names, unchanged identities, stored strings, budgets and history', () => {
  for (const preset of CATEGORY_PRESETS) {
    const key = `categories.${preset.kind}.${preset.key}`;
    assert.equal(leaf(es, key), preset.label, 'the Spanish name is the preset label: ' + key);
    assert.equal(typeof leaf(en, key), 'string', 'English name for ' + key);
    const identity = resolveCategory(preset.kind, preset.label);
    const english = localizeCategory(identity, 'en');
    assert.deepEqual([english.kind, english.key, english.storedLabel, english.icon, english.color, english.archived],
      [identity.kind, identity.key, identity.storedLabel, identity.icon, identity.color, identity.archived], 'only the display name changes');
    assert.equal(localizeCategory(identity, 'es'), identity, 'Spanish returns the same identity');
  }
  assert.equal(localizedCategoryLabel(resolveCategory('expense', 'comida'), 'en'), 'Food', 'any spelling of the stored key');
  assert.equal(localizedCategoryLabel(resolveCategory('income', 'Regalos'), 'en'), 'Gifts');
  assert.equal(localizedCategoryLabel(resolveCategory('expense', 'Kiosco'), 'en'), 'Kiosco', 'a historical string is the person’s own word');
  const now = '2026-01-01T12:00:00Z';
  const custom = newCategoryDefinition('expense', 'Gimnasio', 'fitness', 'teal', now);
  assert.equal(localizedCategoryLabel(resolveCategory('expense', 'Gimnasio', [custom]), 'en'), 'Gimnasio', 'a custom category is never translated');
  const renamed = editedCategoryDefinition(resolveCategory('expense', 'Comida'), { label: 'Alimentos' }, now);
  assert.equal(localizedCategoryLabel(resolveCategory('expense', 'Comida', [renamed]), 'en'), 'Alimentos', 'a renamed preset keeps the new name');
  const recoloured = editedCategoryDefinition(resolveCategory('expense', 'Comida'), { color: 'rose' }, now);
  assert.equal(localizedCategoryLabel(resolveCategory('expense', 'Comida', [recoloured]), 'en'), 'Food', 'a new colour is not a rename');
  // A budget and every movement group by the stored string's key, which no language changes.
  assert.equal(categoryKey(localizeCategory(resolveCategory('expense', 'Educación'), 'en').storedLabel), 'educacion');
});

test('the category picker lists names in the interface language, finds either name and never creates a duplicate', () => {
  const entries: domain.Entry[] = [];
  const english = categoryChoices(entries, 'expense', '', '', [], 'en');
  const food = english.find(identity => identity.key === 'comida')!;
  assert.deepEqual([food.label, food.storedLabel], ['Food', 'Comida'], 'the movement will record the built-in identity');
  for (const query of ['food', 'FOO', 'comida']) assert.ok(categoryChoices(entries, 'expense', query, '', [], 'en').some(identity => identity.key === 'comida'), query);
  assert.equal(customCategory('Food', english, 'expense'), null, 'typing the English name picks the built-in category');
  assert.equal(customCategory('Comida', english, 'expense'), null);
  assert.equal(customCategory('Kiosco', english, 'expense'), 'Kiosco');
  const spanish = categoryChoices(entries, 'expense', 'comi', '', [], 'es');
  assert.deepEqual(spanish.map(identity => identity.label), ['Comida'], 'Spanish picker unchanged');
  assert.equal(categorySearchText('expense', 'Comida', [], 'en'), 'Food Comida');
  assert.equal(categorySearchText('expense', 'Comida'), 'Comida');
});

test('Movimientos search matches the displayed category name and the translated word for a transfer', () => {
  const account: domain.Account = { id: 'a', name: 'Caja', currency: 'ARS', openingMinor: 0, createdAt: '2026-01-01T12:00:00Z' };
  const entry: domain.Entry = { id: 'e', accountId: 'a', kind: 'expense', amountMinor: 100, merchant: 'Kiosco', category: 'Comida', dateISO: '2026-01-01', createdAt: account.createdAt };
  assert.equal(selectEntries([entry], [account], 'all', 'food').length, 0, 'without the displayed name, only the stored string is searched');
  const label = (item: domain.Entry) => localizedCategoryLabel(resolveCategory(item.kind, item.category), 'en');
  assert.equal(selectEntries([entry], [account], 'all', 'food', undefined, label).length, 1);
  assert.equal(selectEntries([entry], [account], 'all', 'comida', undefined, label).length, 1, 'the stored name still matches');
  const transfer: domain.Transfer = { id: 't', fromAccountId: 'a', toAccountId: 'b', amountMinor: 1, note: '', dateISO: '2026-01-01', createdAt: account.createdAt };
  const accounts = [account, { ...account, id: 'b', name: 'Banco' }];
  assert.equal(selectTransfers([transfer], accounts, 'transfer').length, 1, 'the Spanish word already contains it');
  assert.equal(selectTransfers([transfer], accounts, 'transferencia', undefined, 'Transfer').length, 1);
});

test('row dates: Spanish is the domain label byte for byte; English names today and yesterday and writes other days', () => {
  const today = '2026-09-23';
  const base = Date.parse(today + 'T12:00:00Z');
  for (let offset = -40; offset <= 420; offset += 1) {
    const iso = new Date(base - offset * 86400000).toISOString().slice(0, 10);
    assert.equal(relativeDate(iso, today, 'es-AR'), labelFromISO(iso, new Date(today + 'T12:00:00')), iso);
  }
  assert.equal(relativeDate(today, today, 'en-AR'), 'Today');
  assert.equal(relativeDate('2026-09-22', today, 'en-US'), 'Yesterday');
  assert.equal(relativeDate('2026-09-21', today, 'en-AR'), 'Sep 21');
  assert.equal(relativeDate('2025-12-31', today, 'en-AR'), 'Dec 31, 2025');
  assert.equal(relativeDate('2026-09-30', today, 'es-AR'), '30 sep', 'a future date is never relative');
  assert.equal(relativeDate('nope', today, 'en-AR'), 'nope');
  assert.equal(bindLocale('en-AR').relativeDate(today, today), 'Today');
});

test('account kinds are named in the interface language; the Spanish default is unchanged', () => {
  const account: domain.Account = { id: 'a', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt: '2026-01-01T12:00:00Z' };
  const card = { id: 'c', accountId: 'a' } as domain.CreditCardProfile;
  assert.equal(accountKindLabel(account, [card]), 'Tarjeta de crédito');
  assert.equal(accountKindLabel(account, [card], [], translator('en')), 'Credit card');
  assert.equal(accountKindLabel(account, [], [], translator('en')), 'Account');
});

test('English fits where Spanish fits: segment, tab, quick-action, button and header labels stay within their room', () => {
  // Segments share a row (Choices shrinks to 80 % at most); tab and quick-action captions sit under a glyph;
  // buttons and headers are one line on a 320 pt iPhone SE at the default text size.
  const budgets: [string[], number][] = [
    [['activity.all', 'activity.expenses', 'activity.incomes', 'activity.transfers', 'movement.expense', 'movement.income', 'movement.transfer',
      'home.spending', 'home.available'], 13],
    [['nav.tabs.home', 'nav.tabs.activity', 'nav.tabs.assistant', 'nav.tabs.reports', 'nav.tabs.more',
      'quickActions.assistant', 'quickActions.expense', 'quickActions.income', 'quickActions.transfer'], 11],
    [['common.addAccount', 'common.retrySave', 'common.retryChange', 'common.saveChanges', 'entryForm.saveExpense', 'entryForm.saveIncome',
      'transferForm.recordPayment', 'transferForm.recordCollection', 'transferForm.recordTransfer', 'entryDetail.edit', 'entryDetail.restoreAction',
      'entryDetail.voidAction', 'transferDetail.edit', 'transferDetail.restoreAction', 'transferDetail.voidAction', 'activity.clearFilters', 'home.start',
      'transferForm.payTotal', 'transferForm.settleTotal', 'transferForm.collectTotal', 'transferForm.useAll'], 24],
    [Object.keys(es.nav.titles).map(key => 'nav.titles.' + key).concat(['entryForm.editTitle', 'entryForm.cardPurchaseTitle', 'entryForm.expenseTitle',
      'entryForm.incomeTitle', 'transferForm.title', 'transferForm.editTitle', 'entryDetail.voidedTitle', 'transferDetail.voidedTitle',
      'transferDetail.cardPayment', 'transferDetail.debtPayment']), 24],
  ];
  for (const [keys, limit] of budgets) for (const key of keys) for (const language of ['es', 'en'] as const) {
    const text = translate(language, key as never);
    assert.ok(text.length <= limit, `${language} ${key} "${text}" is ${text.length} characters, more than ${limit}`);
  }
});
