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
  // 25O1 review: each alert as iOS would show it: its text and its buttons (built in the screen's own realm, so as JSON).
  const alerts: { title: string; message?: string; buttons: string }[] = [];
  const modules: Record<string, unknown> = {
    react: { useMemo: (fn: () => unknown) => fn(), useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = value; }]; } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { FlatList: 'FlatList', View: 'View', StyleSheet: { create: (styles: unknown) => styles },
      Alert: { alert: (title: string, message?: string, buttons?: unknown) => alerts.push({ title, message, buttons: JSON.stringify(buttons) }) } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' } },
    '../i18n/provider': { useI18n: () => bindLocale('es-AR') },
    './components': { AppText: 'AppText', CheckRow: 'CheckRow', ErrorMessage: 'ErrorMessage', Field: 'Field', PressFeedback: 'PressFeedback' },
    './choice-list': choiceList, './marks': { FlagTile: 'FlagTile', RegionMark: 'RegionMark' },
    './motion': { selectionHaptic: () => haptics.push('selection') },
    './theme': { radius: { group: 16 }, space: { s: 8, m: 12, l: 16, xl: 20 }, usePalette: () => ({ background: '#F2F2F6', surface: '#FFFFFF' }), useReduceMotion: () => reduced },
  };
  const module = { exports: {} as Record<string, (p: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected choice-screen dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; return module.exports.ChoiceScreen!(props); }, haptics, alerts, groupStyle: module.exports.groupStyle as unknown as (position: string) => Record<string, unknown> };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...nodes(value.props.children), ...nodes(value.props.ListHeaderComponent), ...nodes(value.props.ListEmptyComponent), ...nodes(value.props.ListFooterComponent)];
}
const list = (root: Node) => nodes(root).find(node => node.type === 'FlatList')!;
const rendered = (root: Node) => list(root).props.data.map((item: any) => list(root).props.renderItem({ item }));
/** Every ErrorMessage the screen draws in its list, wherever it sits: the header, under a row, the list's footer (25O1
 * review: none, a refusal is an alert). */
const errorsIn = (root: Node) => [...nodes(list(root).props.ListHeaderComponent), ...rendered(root).flatMap(nodes), ...nodes(list(root).props.ListFooterComponent)]
  .filter(node => node.type === 'ErrorMessage').map(node => node.props.message);

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
  assert.match(nodes(list(root).props.ListFooterComponent).filter(node => node.type === 'AppText').map(node => String(node.props.children)).join(' '), /No modifica nada/,
    'a short list keeps its note under its last card');
  assert.deepEqual(errorsIn(root), [], 'no error line');
  // Insets (review of PR #60): the list is the scroll view iOS insets, like `Screen`: navigation bar, home indicator and,
  // with the search focused, the keyboard; the footnote lives in the list's footer, so it scrolls clear too.
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
  // A refused save: the checkmark stays (selected unchanged), and 25O1 review: an alert says so, never a line in the list.
  field.props.onChangeText('jap');
  root = many.render();
  nodes(rendered(root)[1]).find(node => node.type === 'CheckRow')!.props.onPress();
  root = many.render();
  assert.deepEqual(many.alerts.map(alert => alert.title), ['No se pudo guardar la preferencia. Tu elección anterior sigue activa; probá de nuevo.']);
  assert.deepEqual(errorsIn(root), []);
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
  assert.deepEqual(errorsIn(root), []);
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
  assert.deepEqual(errorsIn(root), []);
  assert.deepEqual([searchField(root).props.value, list(root).props.data.map((row: any) => row.option.value), noMatchText(root)], ['jap', ['system', 'JP'], []], 'the search is not reset by a choice');
  nodes(rendered(root)[0]).find(node => node.type === 'CheckRow')!.props.onPress();
  assert.deepEqual(chosen, ['JP', 'system'], 'the pinned option is choosable with a search active too');
});

// 24UX6E (bug fix): the pinned card stands 20 pt apart from the options card that follows it at once, so two rounded
// cards no longer touch (short lists, and a query); before a section header it needs no margin, the header pads itself.
const flatStyle = (row: Node) => Object.assign({}, ...[row.props.style].flat(Infinity).filter(Boolean));
const renderedAt = (root: Node) => list(root).props.data.map((item: any, index: number) => list(root).props.renderItem({ item, index }));
test('the pinned card is detached from an options card that follows it at once, not from a section header', () => {
  const options = [{ value: 'es', title: 'Español', language: 'es' }, { value: 'en', title: 'English', language: 'en' }];
  const few = screen({ title: 'Idioma', options, pinned, selected: 'es', onChoose: () => true });
  let rows = renderedAt(few.render());
  assert.deepEqual(rows.map((row: Node) => flatStyle(row).marginBottom), [20, undefined, undefined], 'short list: only the pinned card gets the block gap');
  assert.equal(flatStyle(rows[0]).borderRadius, 16, 'the pinned card keeps its own rounded corners');

  const many = regionScreen(() => true);
  let root = many.render();
  rows = renderedAt(root);
  assert.equal(list(root).props.data[1].kind, 'header');
  assert.equal(flatStyle(rows[0]).marginBottom, undefined, 'a section header follows: no margin');
  assert.equal(rows.slice(1).filter((row: Node) => row.type === 'View' && flatStyle(row).marginBottom !== undefined).length, 0, 'no other row is detached');
  searchField(root).props.onChangeText('jap');
  root = many.render();
  rows = renderedAt(root);
  assert.deepEqual(rows.map((row: Node) => flatStyle(row).marginBottom), [20, undefined], 'a query: the pinned card stands apart from the match');
  searchField(root).props.onChangeText('xyzzy');
  root = many.render();
  assert.deepEqual(renderedAt(root).map((row: Node) => flatStyle(row).marginBottom), [undefined], 'nothing follows: no margin');

  const bare = screen({ title: 'Idioma', options, selected: 'es', onChoose: () => true });
  assert.deepEqual(renderedAt(bare.render()).map((row: Node) => flatStyle(row).marginBottom), [undefined, undefined], 'without a pinned option nothing is detached');
});

// 25O1: marks, and nothing on the 234-region list waiting at its end.
const regionOptions = () => regionChoices('es').map(choice => ({ value: choice.code, title: choice.name, searchText: choice.searchText, region: choice.code }));
const markedPinned = { ...pinned, glyph: 'phone-portrait-outline' as const };
const checkRow = (row: Node) => nodes(row).find(node => node.type === 'CheckRow')!;
const textsOf = (tree: Node[]) => tree.filter(node => node.type === 'AppText').map(node => String(node.props.children));

test('25O1: a row leads with the mark its option carries: a region its own flag, the device row a neutral glyph, a language nothing', () => {
  const regions = screen({ title: 'Región', options: regionOptions(), pinned: markedPinned, recent: ['UY'], selected: 'UY', onChoose: () => true });
  const rows = rendered(regions.render());
  const leading = (row: Node) => checkRow(row)?.props.leading;
  assert.deepEqual([leading(rows[0]).type, leading(rows[0]).props.flag, leading(rows[0]).props.fallback], ['FlagTile', null, 'phone-portrait-outline'], 'the pinned row: a neutral tile');
  const data = list(regions.render()).props.data as any[];
  const marked: [any, any][] = rows.map((row: Node, index: number) => [data[index], leading(row)]).filter(([item]: [any, any]) => item.kind === 'choice' && !item.pinned);
  assert.equal(marked.length, 257 + 1, 'every region row of the catalogue, the recent one included');
  assert.equal(marked.every(([item, mark]) => mark.type === 'RegionMark' && mark.props.region === item.option.value), true, 'each region shows its own code\'s mark');
  assert.equal(marked.some(([item]) => item.key === 'recent:UY'), true);
  assert.equal(marked.every(([item]) => checkRow(rows[data.indexOf(item)]).props.accessibilityLanguage === undefined), true);
  // VoiceOver: the label is the title and the subtitle, as before; the mark hides itself (marks.tsx).
  const languages = screen({ title: 'Idioma', options: [{ value: 'es', title: 'Español', language: 'es' }, { value: 'en', title: 'English', language: 'en' }], pinned, selected: 'es', onChoose: () => true });
  assert.deepEqual(rendered(languages.render()).map((row: Node) => leading(row)), [undefined, undefined, undefined], 'a language never shows a flag');
});

test('25O1: the long list says its note under the pinned card (gone while a search is typed); a short list keeps it under its last card, with its text button', () => {
  const opened: string[] = [];
  const many = screen({ title: 'Región', options: regionOptions(), pinned: markedPinned, selected: 'system', onChoose: () => true, note: 'Cambia cómo se escriben fechas y números.' });
  let root = many.render();
  assert.equal(list(root).props.ListFooterComponent, null, 'nothing waits after 234 regions');
  let rows = rendered(root);
  assert.deepEqual(textsOf(nodes(rows[0])), ['Cambia cómo se escriben fechas y números.'], 'under the pinned card, read before the list');
  assert.equal(rows.slice(1).some((row: Node) => textsOf(nodes(row)).includes('Cambia cómo se escriben fechas y números.')), false, 'once');
  assert.equal(checkRow(rows[0]).props.title, 'Según el dispositivo', 'the card itself is unchanged');
  searchField(root).props.onChangeText('uru');
  root = many.render();
  rows = rendered(root);
  assert.deepEqual(rows.flatMap((row: Node) => textsOf(nodes(row))), [], 'a search shows only its matches');
  assert.equal(list(root).props.ListFooterComponent, null);

  const few = screen({ title: 'Idioma', options: [{ value: 'es', title: 'Español', language: 'es' }, { value: 'en', title: 'English', language: 'en' }], pinned, selected: 'es', onChoose: () => true,
    note: 'Para que iOS también use este idioma en sus menús, elegilo en Ajustes.', noteAction: { label: 'Abrir Ajustes', onPress: () => opened.push('settings') } });
  root = few.render();
  assert.deepEqual(rendered(root).flatMap((row: Node) => textsOf(nodes(row))), [], 'a short list draws no footer under its rows');
  const footer = nodes(list(root).props.ListFooterComponent);
  assert.deepEqual(textsOf(footer), ['Para que iOS también use este idioma en sus menús, elegilo en Ajustes.', 'Abrir Ajustes']);
  const button = footer.find(node => node.type === 'PressFeedback')!;
  assert.deepEqual([button.props.accessibilityRole, button.props.accessibilityLabel, button.props.feedback, button.props.containerStyle.alignSelf], ['button', 'Abrir Ajustes', 'opacity', 'flex-start'],
    'a text button (PressFeedback keeps its 44 pt), as wide as its words');
  button.props.onPress();
  assert.deepEqual(opened, ['settings']);
  const bare = screen({ title: 'Apariencia', options: [{ value: 'light', title: 'Claro' }, { value: 'dark', title: 'Oscuro' }], pinned, selected: 'light', onChoose: () => true });
  assert.equal(list(bare.render()).props.ListFooterComponent, null, 'no note, no footer');
});

test('25O1 review: a refused save is said in an alert, in front wherever the list is scrolled, never as a line in it; the checkmark stays, nothing taps, and each refusal says it again', () => {
  let refuse = true;
  const many = screen({ title: 'Región', options: regionOptions(), pinned: markedPinned, recent: ['UY'], selected: 'system', onChoose: () => !refuse, note: 'Nota.' });
  let root = many.render();
  const data = () => list(root).props.data as any[];
  const at = (key: string) => data().findIndex(item => item.key === key);
  const refused = { title: 'No se pudo guardar la preferencia. Tu elección anterior sigue activa; probá de nuevo.', message: undefined,
    buttons: JSON.stringify([{ text: 'OK', style: 'cancel' }]) };
  // India, deep in the I section (28 regions): a line under its card was drawn 27 rows below the finger.
  checkRow(rendered(root)[at('I:IN')]).props.onPress();
  root = many.render();
  assert.deepEqual(many.alerts, [refused], 'once, with the app\'s own OK');
  assert.deepEqual(errorsIn(root), [], 'nothing drawn in the list');
  assert.equal(checkRow(rendered(root)[0]).props.selected, true, 'the checkmark stays on the saved choice');
  assert.deepEqual(many.haptics, [], 'a preference change has no failure tap');
  // The same option among the recents, then a search match: each refusal alerts once more.
  checkRow(rendered(root)[at('recent:UY')]).props.onPress();
  searchField(root).props.onChangeText('a');
  root = many.render();
  checkRow(rendered(root)[1]).props.onPress();
  root = many.render();
  assert.deepEqual([many.alerts.length, errorsIn(root)], [3, []], 'a retry says it again');
  checkRow(rendered(root)[0]).props.onPress();
  assert.equal(many.alerts.length, 3, 'a tap on the checked row saves nothing and says nothing');
  refuse = false;
  checkRow(rendered(root)[1]).props.onPress();
  root = many.render();
  assert.deepEqual([many.alerts.length, many.haptics, errorsIn(root)], [3, ['selection'], []], 'a save that lands alerts nothing');
  // The pinned row refused: the alert, and its card keeps only the note under it.
  const chosen = screen({ title: 'Región', options: regionOptions(), pinned: markedPinned, selected: 'UY', onChoose: () => false, note: 'Nota.' });
  root = chosen.render();
  checkRow(rendered(root)[0]).props.onPress();
  root = chosen.render();
  assert.deepEqual([chosen.alerts, textsOf(nodes(rendered(root)[0])), errorsIn(root)], [[refused], ['Nota.'], []]);
});
