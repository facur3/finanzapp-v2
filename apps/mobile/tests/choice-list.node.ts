import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { bindLocale } from '../src/i18n/bind.ts';
import * as choiceList from '../src/ui/choice-list.ts';
import { regionChoices } from '../src/i18n/regions.ts';

// Producto 24R1: the searchable single-choice list that the Región and Idioma choosers will
// use once the catalogue's regions are released (24R2): the rows it builds (pure), and the real
// ChoiceScreen with its hosts replaced by descriptors. Not a rendered iOS screen; the device
// checks of 24R2 cover scrolling, Dynamic Type at the largest sizes and VoiceOver.
const { SEARCHABLE_CHOICES, buildChoiceRows, filterChoices, sectionInitial } = choiceList;
type Node = { type: any; props: Record<string, any> };

const options = [
  { value: 'DE', title: 'Alemania' }, { value: 'AR', title: 'Argentina' }, { value: 'AX', title: 'Åland' }, { value: 'BR', title: 'Brasil' },
  { value: 'JP', title: 'Japón', subtitle: '2026/09/22' }, { value: 'ES', title: 'España' }, { value: 'US', title: 'Estados Unidos' },
];
const pinned = { value: 'system', title: 'Según el dispositivo', subtitle: 'Ahora: Japón (formatos de Argentina)' };

test('rows: the pinned option first, the recent ones under their header, then alphabetical sections by folded initial with grouped positions and the checkmark', () => {
  const rows = buildChoiceRows({ pinned, recent: ['JP', 'XX', 'AR'], options, selected: 'AR', recentTitle: 'Recientes' });
  const shape = rows.map(row => row.kind === 'header' ? '# ' + row.title : `${row.option.value}:${row.position}${row.selected ? '*' : ''}`);
  assert.deepEqual(shape, ['system:only', '# Recientes', 'JP:first', 'AR:last*', '# A', 'DE:first', 'AR:middle*', 'AX:last', '# B', 'BR:only', '# J', 'JP:only', '# E', 'ES:first', 'US:last']);
  assert.deepEqual(rows.map(row => row.key).length, new Set(rows.map(row => row.key)).size, 'keys are unique although JP and AR appear twice');
  assert.equal(buildChoiceRows({ options, selected: null, recentTitle: 'Recientes' })[0].kind, 'header', 'no pinned option, no recent: the first section starts at once');
  assert.deepEqual(buildChoiceRows({ pinned, options: [], selected: 'system', recentTitle: 'Recientes' }).map(row => row.key), ['pinned:system']);
  assert.deepEqual(rows.map(row => row.kind === 'choice' && row.pinned === true), [true, ...rows.slice(1).map(() => false)], 'only the pinned row is marked pinned, so a screen can tell a real match from it');
  assert.deepEqual([sectionInitial('Álava'), sectionInitial('åland'), sectionInitial('日本'), sectionInitial('  Zambia'), sectionInitial('1 de mayo'), sectionInitial('')], ['A', 'A', '#', 'Z', '#', '#']);
});

test('a query gives one flat ranked list without headers, the pinned option still first; nothing matching leaves only the pinned option', () => {
  const rows = buildChoiceRows({ pinned, recent: ['JP'], options, selected: 'JP', query: 'es', recentTitle: 'Recientes' });
  assert.deepEqual(rows.map(row => row.kind === 'header' ? '#' : row.option.value), ['system', 'ES', 'US'], 'value prefix (ES) before name prefix (Estados Unidos)');
  assert.deepEqual(rows.map(row => row.kind === 'choice' ? row.position : '#'), ['only', 'first', 'last']);
  assert.deepEqual(buildChoiceRows({ pinned, options, selected: null, query: '  ', recentTitle: 'Recientes' }).some(row => row.kind === 'header'), true, 'blank is no query');
  assert.deepEqual(buildChoiceRows({ pinned, options, selected: null, query: 'zzz', recentTitle: 'Recientes' }).map(row => row.key), ['pinned:system']);
  assert.deepEqual(filterChoices('japon', options).map(option => option.value), ['JP'], 'accents ignored');
  assert.deepEqual(filterChoices('a', options).map(option => option.value), ['AR', 'AX', 'DE', 'BR', 'JP', 'ES', 'US'].filter(value => ['AR', 'AX', 'DE'].includes(value)).concat(['BR', 'JP', 'ES', 'US'].filter(value => options.find(option => option.value === value)!.title.toLowerCase().includes('a'))), 'value prefix, then name prefix, then any match, in the given order');
  assert.deepEqual(filterChoices('2026', options).map(option => option.value), [], 'a subtitle is not searched unless the caller folds it into searchText');
  assert.deepEqual(filterChoices('2026', [{ value: 'JP', title: 'Japón', searchText: 'japon jp 2026' }]).map(option => option.value), ['JP']);
  assert.equal(SEARCHABLE_CHOICES, 6);
});

function screen(props: any, { reduced = true } = {}) {
  const source = readFileSync(new URL('../src/ui/choice-screen.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, p: any) => ({ type, props: p });
  const state: unknown[] = [];
  let cursor = 0;
  const haptics: string[] = [];
  const modules: Record<string, unknown> = {
    react: { useMemo: (fn: () => unknown) => fn(), useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = value; }]; } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { FlatList: 'FlatList', View: 'View', StyleSheet: { create: (styles: unknown) => styles } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    '../i18n/provider': { useI18n: () => bindLocale('es-AR') },
    './components': { AppText: 'AppText', CheckRow: 'CheckRow', ErrorMessage: 'ErrorMessage', Field: 'Field' },
    './choice-list': choiceList,
    './motion': { selectionHaptic: () => haptics.push('selection') },
    './theme': { radius: { group: 16 }, space: { s: 8, m: 12, l: 16, xl: 20 }, usePalette: () => ({ background: '#F2F2F6', surface: '#FFFFFF' }), useReduceMotion: () => reduced },
  };
  const module = { exports: {} as Record<string, (p: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected choice-screen dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; return module.exports.ChoiceScreen!(props); }, haptics, groupStyle: module.exports.groupStyle as unknown as (position: string) => Record<string, unknown> };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...nodes(value.props.children), ...nodes(value.props.ListHeaderComponent), ...nodes(value.props.ListEmptyComponent), ...nodes(value.props.ListFooterComponent)];
}
const list = (root: Node) => nodes(root).find(node => node.type === 'FlatList')!;
const rendered = (root: Node) => list(root).props.data.map((item: any) => list(root).props.renderItem({ item }));

test('the screen: a search field only from six options, header rows as VoiceOver headers, CheckRow rows grouped by position, autonyms with their language, and the footnote outside the list', () => {
  const chosen: string[] = [];
  const few = screen({ title: 'Idioma', options: [{ value: 'es', title: 'Español', language: 'es' }, { value: 'en', title: 'English', language: 'en' }], pinned, recent: ['en'], selected: 'es', onChoose: (value: string) => { chosen.push(value); return true; }, note: 'No modifica nada.' });
  let root = few.render();
  assert.equal(nodes(root).find(node => node.type === 'Stack.Screen')!.props.options.title, 'Idioma');
  assert.equal(list(root).props.ListHeaderComponent, null, 'two options are read, not searched');
  assert.equal(list(root).props.keyboardShouldPersistTaps, 'handled');
  assert.equal(list(root).props.removeClippedSubviews, false);
  const rows = rendered(root);
  assert.deepEqual(rows.map((row: Node) => nodes(row).find(node => node.type === 'CheckRow')?.props.title ?? '# ' + row.props.children), ['Según el dispositivo', 'Español', 'English'],
    'a short list (24R2A): one card in the caller\'s order under the pinned row, no recents, no lettered section');
  const english = nodes(rows[2]).find(node => node.type === 'CheckRow')!;
  assert.deepEqual([english.props.accessibilityLanguage, english.props.selected, english.props.last], ['en', false, true], 'an autonym is spoken in its own language');
  assert.deepEqual([nodes(rows[1]).find(node => node.type === 'CheckRow')!.props.selected, nodes(rows[1]).find(node => node.type === 'CheckRow')!.props.last, nodes(rows[1]).find(node => node.type === 'CheckRow')!.props.accessibilityLanguage], [true, false, 'es']);
  assert.deepEqual(list(root).props.data.map((row: any) => row.kind === 'choice' ? row.position : '#'), ['only', 'first', 'last']);
  assert.deepEqual([few.groupStyle('first'), few.groupStyle('last'), few.groupStyle('only'), few.groupStyle('middle')].map(style => Object.keys(style).sort().join(',')),
    ['borderTopLeftRadius,borderTopRightRadius', 'borderBottomLeftRadius,borderBottomRightRadius', 'borderRadius,marginTop', ''], 'consecutive rows draw one grouped card');
  assert.match(nodes(list(root).props.ListFooterComponent).filter(node => node.type === 'AppText').map(node => String(node.props.children)).join(' '), /No modifica nada/);
  assert.equal(nodes(list(root).props.ListFooterComponent).find(node => node.type === 'ErrorMessage')!.props.message, null);
  // Insets (review of PR #60): the list is the scroll view iOS insets, like `Screen`: navigation bar, home indicator and,
  // with the search focused, the keyboard; the error and the footnote live in the list's footer, so they scroll clear too.
  assert.deepEqual([list(root).props.contentInsetAdjustmentBehavior, list(root).props.automaticallyAdjustKeyboardInsets, list(root).props.keyboardDismissMode],
    ['automatic', true, 'interactive']);
  assert.equal(JSON.stringify(list(root).props.style), JSON.stringify({ flex: 1, backgroundColor: '#F2F2F6' }));
  assert.equal(list(root).props.contentContainerStyle.flexGrow, 1);
  assert.equal(nodes(root).filter(node => node.type === 'View' && node.props.style?.flex === 1).length, 0, 'no wrapper view between the screen and its scroll view');
  // Choosing: the current option does nothing; another saves, ticks and keeps no error.
  nodes(rows[1]).find(node => node.type === 'CheckRow')!.props.onPress();
  assert.deepEqual([chosen, few.haptics], [[], []]);
  english.props.onPress();
  assert.deepEqual([chosen, few.haptics], [['en'], ['selection']]);

  const spanish = regionChoices('es');
  const many = screen({ title: 'Región', options: spanish.map(choice => ({ value: choice.code, title: choice.name, searchText: choice.searchText })), pinned, recent: ['JP', 'GB'], selected: 'AR', onChoose: () => false });
  root = many.render();
  const field = nodes(list(root).props.ListHeaderComponent).find(node => node.type === 'Field')!;
  assert.deepEqual([field.props.label, field.props.value, field.props.autoCapitalize], ['Buscar', '', 'none'], 'a search field over 257 regions');
  assert.deepEqual(list(root).props.data.slice(0, 5).map((row: any) => row.kind === 'header' ? '# ' + row.title : row.option.value), ['system', '# Recientes', 'JP', 'GB', '# A']);
  assert.equal(list(root).props.data.filter((row: any) => row.kind === 'choice').length, 257 + 1 + 2);
  assert.equal(rendered(root)[1].props.accessibilityRole, 'header', 'a section header is a VoiceOver header');
  assert.equal(list(root).props.initialNumToRender, 16, 'virtualized: a window of rows, never the whole list at once');
  field.props.onChangeText('jap');
  root = many.render();
  assert.deepEqual(list(root).props.data.map((row: any) => row.kind === 'header' ? '#' : row.option.value), ['system', 'JP'], 'a query: flat matches, the pinned option first');
  // A refused save: the checkmark stays (selected unchanged), the footer says so.
  field.props.onChangeText('jap');
  root = many.render();
  nodes(rendered(root)[1]).find(node => node.type === 'CheckRow')!.props.onPress();
  root = many.render();
  assert.equal(nodes(list(root).props.ListFooterComponent).find(node => node.type === 'ErrorMessage')!.props.message, 'No se pudo guardar la preferencia. Tu elección anterior sigue activa; probá de nuevo.');
  assert.deepEqual(many.haptics, []);
});

// The no-match sentence lives under the search field, not in `ListEmptyComponent`: with a pinned option
// the list is never empty, so React Native would never draw it there (review of PR #53).
const noMatchText = (root: Node) => nodes(list(root).props.ListHeaderComponent).filter(node => node.type === 'AppText').map(node => String(node.props.children));
const regionScreen = (onChoose: (value: string) => boolean, withPinned = true) => screen({ title: 'Región', options: regionChoices('es').map(choice => ({ value: choice.code, title: choice.name, searchText: choice.searchText })), pinned: withPinned ? pinned : undefined, recent: ['JP'], selected: 'AR', onChoose });
const searchField = (root: Node) => nodes(list(root).props.ListHeaderComponent).find(node => node.type === 'Field')!;

test('confirming the checked option: Más (no onConfirm) does nothing; a flow with onConfirm continues, and nothing is saved', () => {
  const saves: string[] = [], confirmed: string[] = [];
  const options = [{ value: 'es', title: 'Español', language: 'es' }, { value: 'en', title: 'English', language: 'en' }];
  const more = screen({ title: 'Idioma', options, pinned, selected: 'es', onChoose: (value: string) => { saves.push(value); return true; } });
  let root = more.render();
  nodes(rendered(root)[1]).find(node => node.type === 'CheckRow')!.props.onPress();
  assert.deepEqual([saves, more.haptics], [[], []], 'Más: a tap on the checked row changes nothing');
  const onboarding = screen({ title: 'Idioma', options, pinned, selected: 'es', onChoose: (value: string) => { saves.push(value); return true; }, onConfirm: (value: string) => confirmed.push(value) });
  root = onboarding.render();
  nodes(rendered(root)[1]).find(node => node.type === 'CheckRow')!.props.onPress();
  assert.deepEqual([saves, confirmed, onboarding.haptics], [[], ['es'], []], 'confirmed without a save or a haptic');
  root = onboarding.render();
  assert.equal(nodes(list(root).props.ListFooterComponent).find(node => node.type === 'ErrorMessage')!.props.message, null);
  nodes(rendered(root)[2]).find(node => node.type === 'CheckRow')!.props.onPress();
  assert.deepEqual([saves, confirmed], [['en'], ['es']], 'another option is still a save, not a confirmation');
});

test('a search with no match says so under the field although the pinned option stays; a match or a cleared search removes the sentence', () => {
  const many = regionScreen(() => true);
  let root = many.render();
  assert.deepEqual(noMatchText(root), [], 'no query: no sentence');
  searchField(root).props.onChangeText('xyzzy');
  root = many.render();
  assert.deepEqual(list(root).props.data.map((row: any) => row.option.value), ['system'], 'the pinned option remains: the list is not empty');
  assert.deepEqual(noMatchText(root), ['Sin coincidencias'], 'the sentence is drawn nevertheless');
  assert.equal(list(root).props.ListEmptyComponent, undefined, 'nothing relies on an empty list any more');
  assert.equal(nodes(rendered(root)[0]).find(node => node.type === 'CheckRow')!.props.title, 'Según el dispositivo', 'the pinned row is still a row');
  searchField(root).props.onChangeText('jap');
  root = many.render();
  assert.deepEqual([list(root).props.data.map((row: any) => row.option.value), noMatchText(root)], [['system', 'JP'], []], 'a successful search lists its matches and no sentence');
  searchField(root).props.onChangeText('   ');
  root = many.render();
  assert.deepEqual([noMatchText(root), list(root).props.data.filter((row: any) => row.kind === 'choice').length], [[], 257 + 1 + 1], 'a blank query is the whole list');

  const bare = regionScreen(() => true, false);
  root = bare.render();
  searchField(root).props.onChangeText('xyzzy');
  root = bare.render();
  assert.deepEqual([list(root).props.data, noMatchText(root)], [[], ['Sin coincidencias']], 'without a pinned option the list is empty and the same sentence is drawn in the same place');
});

test('choosing from the list while a search is active saves, ticks and keeps the query', () => {
  const chosen: string[] = [];
  const many = regionScreen(value => { chosen.push(value); return true; });
  let root = many.render();
  searchField(root).props.onChangeText('jap');
  root = many.render();
  const japan = nodes(rendered(root)[1]).find(node => node.type === 'CheckRow')!;
  assert.deepEqual([japan.props.title, japan.props.selected], ['Japón', false]);
  japan.props.onPress();
  root = many.render();
  assert.deepEqual([chosen, many.haptics], [['JP'], ['selection']]);
  assert.equal(nodes(list(root).props.ListFooterComponent).find(node => node.type === 'ErrorMessage')!.props.message, null);
  assert.deepEqual([searchField(root).props.value, list(root).props.data.map((row: any) => row.option.value), noMatchText(root)], ['jap', ['system', 'JP'], []], 'the search is not reset by a choice');
  nodes(rendered(root)[0]).find(node => node.type === 'CheckRow')!.props.onPress();
  assert.deepEqual(chosen, ['JP', 'system'], 'the pinned option is choosable with a search active too');
});
