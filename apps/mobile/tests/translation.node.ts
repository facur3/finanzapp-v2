import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as domain from '@finanzapp/domain';
import { CATEGORY_PRESETS, categoryKey, labelFromISO, newCategoryDefinition, editedCategoryDefinition, resolveCategory, validateEntry, validateTransfer } from '@finanzapp/domain';
import { es } from '../src/i18n/messages/es/index.ts';
import { en } from '../src/i18n/messages/en/index.ts';
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
import { isPluralEntry, pluralCategory, translator } from '../src/i18n/messages.ts';
import { findLiterals } from '../scripts/i18n/extract.mjs';
import { checkCatalogues, requiredPlurals } from '../scripts/i18n/check.mjs';
import { exportLanguage } from '../scripts/i18n/export.mjs';
import { pseudoCatalogue, pseudoText } from '../scripts/i18n/pseudo.mjs';

// Producto 23.1B1 and 23.1B2: every screen reads its visible strings from the
// catalogues. English is complete and released since Producto 23.1C2.

const root = new URL('..', import.meta.url).pathname;
const read = (file: string) => readFileSync(join(root, file), 'utf8');
const leaf = (catalogue: object, key: string): unknown => key.split('.').reduce<any>((node, part) => node?.[part], catalogue);
const isPlural = (value: unknown): value is { one: string; other: string } => isPluralEntry(value);

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap(name => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

test('English is released (23.1C2)', () => {
  assert.deepEqual([...RELEASED_LANGUAGES], ['es', 'en']);
});

test('no screen or component keeps visible copy outside the catalogue (npm run i18n:extract)', () => {
  const found = findLiterals();
  assert.equal(found.length, 0, found.map(item => `${item.file}:${item.line} ${item.text}`).join('\n'));
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
  assert.ok(checked > 600, 'the scan found the translated screens (' + checked + ' calls)');
});

test('both catalogues are complete: no empty text, and English is really English', () => {
  const keys = messageKeys(es);
  assert.deepEqual(messageKeys(en), keys);
  // Identical in both languages on purpose: proper names, format-only templates and the one-word English plural.
  const same = new Set(['preferences.regionNames.AR', 'preferences.regionSample', 'transferForm.figure', 'selection.category',
    // "Pesos" is also the English word; format-only templates; proper and technical names.
    'currency.option', 'currency.short.ARS', 'reports.dayRow', 'reports.insights.largestDetail',
    'reports.chart.donutLabel', 'reports.chart.bar', 'reports.chart.timelineBar', 'categoryManager.list.rowLabel', 'categoryManager.picker.color',
    'categoryManager.icons.internet', 'settings.material.glass', 'assistant.draft.eyebrow', 'assistant.draft.row']);
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
    // A plural may only choose the sentence ("Completá el dato que falta"); if "one" shows the number, "other" must too.
    assert.ok(!forms.one.includes('{count}') || forms.other.includes('{count}'), key + ' shows its number in every form');
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

test('every catalogued error is still thrown verbatim by the domain, the storage layer or the integration client', () => {
  const sources = [...readdirSync(join(root, '../../packages/domain')).filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts')).map(name => '../../packages/domain/' + name),
    ...sourceFiles('src/storage')].map(read).join('\n');
  for (const [group, messages] of Object.entries(es.errors)) for (const [name, text] of Object.entries(messages as Record<string, string>)) {
    // A template ("Ya existe una categoría llamada «{name}».") is thrown as a template literal with any expression in place of each placeholder.
    // validateVersionedRecord builds four of them from `Estado de ${what} inválido.` with what = apariencia | categoría.
    const generated = /^Estado (inicial )?de (apariencia|categoría) inválido\.$/.exec(text);
    if (generated) { assert.ok(sources.includes(`Estado ${generated[1] ?? ''}de \${what} inválido.`), text); continue; }
    const pattern = new RegExp("['`]" + text.split(/\{[a-zA-Z0-9_]+\}/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\$\\{[^}]+\\}') + "['`]");
    assert.ok(pattern.test(sources), `errors.${group}.${name} is no longer thrown as written; update the catalogue with the source`);
  }
  assert.equal(localizeError('en', 'Ya existe una categoría llamada «Gym (2)».'), 'A category named “Gym (2)” already exists.', 'a template keeps its value');
  assert.equal(localizeError('es', '«Kiosco» ya es el nombre de otra categoría.'), '«Kiosco» ya es el nombre de otra categoría.');
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
      'quickActions.expense', 'quickActions.income', 'quickActions.transfer'], 11],
    [['common.addAccount', 'common.retrySave', 'common.retryChange', 'common.saveChanges', 'entryForm.saveExpense', 'entryForm.saveIncome',
      'transferForm.recordPayment', 'transferForm.recordCollection', 'transferForm.recordTransfer', 'entryDetail.edit', 'entryDetail.restoreAction',
      'entryDetail.voidAction', 'transferDetail.edit', 'transferDetail.restoreAction', 'transferDetail.voidAction', 'activity.clearFilters', 'home.start',
      'transferForm.payTotal', 'transferForm.settleTotal', 'transferForm.collectTotal', 'transferForm.useAll', 'quickActions.askAssistant'], 24],
    [Object.keys(es.nav.titles).map(key => 'nav.titles.' + key).concat(['entryForm.editTitle', 'entryForm.cardPurchaseTitle', 'entryForm.expenseTitle',
      'entryForm.incomeTitle', 'transferForm.title', 'transferForm.editTitle', 'entryDetail.voidedTitle', 'transferDetail.voidedTitle',
      'transferDetail.cardPayment', 'transferDetail.debtPayment']), 24],
  ];
  for (const [keys, limit] of budgets) for (const key of keys) for (const language of ['es', 'en'] as const) {
    const text = translate(language, key as never);
    assert.ok(text.length <= limit, `${language} ${key} "${text}" is ${text.length} characters, more than ${limit}`);
  }
});

test('plural categories come from the language’s CLDR rule; a category a catalogue lacks reads "other"', () => {
  assert.equal(pluralCategory('es', 1), 'one');
  assert.equal(pluralCategory('es', 0), 'other');
  assert.equal(pluralCategory('en', 1), 'one');
  assert.equal(pluralCategory('ar', 0), 'zero', 'Arabic has six categories');
  assert.equal(pluralCategory('ar', 2), 'two');
  assert.equal(pluralCategory('ar', 3), 'few');
  assert.equal(pluralCategory('ru', 5), 'many');
  assert.equal(pluralCategory('pl', 22), 'few');
  assert.equal(translate('es', 'count.movements', { count: 1000000 }), '1000000 movimientos', 'Spanish "many" (millions) falls back to other');
  assert.deepEqual(requiredPlurals('es'), ['one', 'other'], 'whole numbers in Spanish need one and other');
  assert.deepEqual(requiredPlurals('ar'), ['few', 'many', 'one', 'other', 'two', 'zero']);
  assert.deepEqual(requiredPlurals('ja'), ['other']);
});

test('the catalogue validator finds no missing keys, placeholder mismatches, plural gaps or stale English (npm run i18n:check)', async () => {
  const report = await checkCatalogues({ strict: true });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.stale, [], 'English was reviewed against the current Spanish (npm run i18n:check -- --accept en after a review)');
});

test('the translation brief for a new language carries source, English reference, context, placeholders, plural categories and glossary', async () => {
  const { file, count } = await exportLanguage('ar', { all: true });
  const brief = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(count, messageKeys(es).length);
  const accounts = brief.entries.find((entry: any) => entry.key === 'home.accounts');
  assert.deepEqual(accounts.plural, ['few', 'many', 'one', 'other', 'two', 'zero']);
  assert.deepEqual(accounts.placeholders, ['count']);
  assert.equal(accounts.english.other, '{count} accounts');
  const help = brief.entries.find((entry: any) => entry.key === 'home.availableHelp');
  assert.ok(help.glossary.some((term: any) => term.es === 'saldo registrado' || term.es === 'cuenta'), 'glossary terms are attached');
  const ranking = brief.entries.find((entry: any) => entry.key === 'home.rankingLabel');
  assert.match(ranking.context, /Comida/, 'the comment above the key is its context');
});

test('pseudo-locales for layout testing keep every placeholder: long text grows about 40 %, RTL is wrapped in embedding marks', () => {
  const long = pseudoText('Registrar {count} movimientos');
  assert.ok(long.includes('{count}'));
  assert.ok(long.length >= Math.round('Registrar {count} movimientos'.length * 1.3));
  const rtl = pseudoText('Hola {name}', 'rtl');
  assert.equal(rtl, '\u202BHólá {name}\u202C');
  const pseudo = pseudoCatalogue(es, 'long') as any;
  for (const key of messageKeys(es)) {
    const a = JSON.stringify(leaf(es, key)), b = JSON.stringify(leaf(pseudo, key));
    assert.deepEqual([...b.matchAll(/\{[a-zA-Z0-9_]+\}/g)].map(m => m[0]).sort(), [...a.matchAll(/\{[a-zA-Z0-9_]+\}/g)].map(m => m[0]).sort(), key);
  }
});

test('a debt’s hidden account is named from the debt in the interface language; Spanish equals the stored name', async () => {
  const { accountDisplayName } = await import('../src/ui/liability-presentation.ts');
  const account: domain.Account = { id: 'd', name: 'Debo · Juan', currency: 'ARS', openingMinor: -100, createdAt: '2026-01-01T12:00:00Z' };
  const debt = { id: 'x', accountId: 'd', direction: 'owed_by_me', counterparty: 'Juan' } as domain.PersonalDebtProfile;
  assert.equal(accountDisplayName(account, [debt]), account.name, 'Spanish reads exactly the stored name');
  assert.equal(accountDisplayName(account, [debt], translator('en')), 'I owe · Juan', 'the person’s name is kept');
  assert.equal(accountDisplayName({ ...account, name: 'Me deben · Ana' }, [{ ...debt, direction: 'owed_to_me', counterparty: 'Ana' }], translator('en')), 'Owed to me · Ana');
  assert.equal(accountDisplayName({ ...account, id: 'cash', name: 'Caja' }, [debt], translator('en')), 'Caja', 'a cash account keeps its own name');
  // Editing the counterparty does not rename the hidden account: the stored name is what shows, in Spanish byte for byte.
  const edited = { ...debt, counterparty: 'Juan Pérez' };
  assert.equal(accountDisplayName(account, [edited]), 'Debo · Juan');
  assert.equal(accountDisplayName(account, [edited], translator('en')), 'I owe · Juan');
  assert.equal(accountDisplayName({ ...account, name: 'Préstamo Juan' }, [debt], translator('en')), 'Préstamo Juan', 'a name without the prefix is shown as stored');
  // The debt form stores the hidden account with the Spanish formula the catalogue reproduces.
  assert.match(read('src/ui/debt-form.tsx'), /'Debo · ' : 'Me deben · '\) \+ counterparty\.trim\(\)/);
});
