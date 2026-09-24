import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { todayKey } from '@finanzapp/domain';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';

// Producto 23.1C2: the real DateField (src/ui/form-controls.tsx) under a
// locale that switches between renders, like the live provider (which never
// remounts its children). The native wheel itself (column order, month
// capitalisation, VoiceOver on the wheel) is a device check; here: what the
// row shows and says, what the picker is given, and that the day the person
// spun survives a language or region change and is saved as an ISO key.
type Node = { type: any; props: Record<string, any> };

function harness(os: 'ios' | 'android' = 'ios') {
  let locale: AppLocale = 'es-AR';
  const source = readFileSync(new URL('../src/ui/form-controls.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  // Hooks persist by call order across renders, like React's, so the sheet and the draft outlive a re-render.
  const state: unknown[] = [];
  let cursor = 0;
  const modules: Record<string, unknown> = {
    react: { useMemo: (fn: () => unknown) => fn(), useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial;
      return [state[index], (value: unknown) => { state[index] = value; }]; } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { FlatList: 'FlatList', Keyboard: { dismiss() {} }, Modal: 'Modal', Platform: { OS: os }, View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@react-native-community/datetimepicker': 'DateTimePicker',
    '@expo/vector-icons/Ionicons': 'Ionicons',
    // The real day key: local calendar fields, never toISOString (UTC), exactly what the forms store.
    '@finanzapp/domain': { todayKey },
    '../i18n/provider': { useI18n: () => bindLocale(locale) },
    './components': { AccountBadge: 'AccountBadge', AppText: 'AppText', CategoryBadge: 'CategoryBadge', DetailRow: 'DetailRow', SelectionRow: 'SelectionRow', Field: 'Field',
      GlyphTile: 'GlyphTile', PressFeedback: 'PressFeedback', Surface: 'Surface', surfaceShadow: () => ({}) },
    './currencies': {}, './category-hues': {}, './categories': {}, './motion': { selectionHaptic: () => {} },
    './theme': { radius: { group: 16 }, usePalette: () => ({ isDark: false, primary: '#2557D6', background: '#F2F2F6' }), useReduceMotion: () => true },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected form-controls dependency: ' + name);
    return modules[name];
  } });
  const saved: string[] = [];
  const props = { value: new Date(2026, 8, 22, 12), onChange: (date: Date) => saved.push(todayKey(date)) };
  const render = () => { cursor = 0; return module.exports.DateField!(props); };
  return { render, saved, setLocale: (next: AppLocale) => { locale = next; } };
}

/** Every node, with local function components (the sheet) rendered in place. */
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...(typeof value.type === 'function' ? nodes(value.type(value.props)) : []), ...nodes(value.props.children)];
}
const find = (root: Node, type: string) => nodes(root).find(node => node.type === type);
const labelOf = (node: Node) => [node.props.children].flat().map(child => typeof child === 'object' ? child?.props?.children : child).join('');
/** The sheet's bar: Cancel, the title, Done, in the order drawn. */
const bar = (root: Node) => nodes(find(root, 'Modal')).filter(node => node.type === 'AppText').map(labelOf);
const button = (root: Node, label: string) => nodes(find(root, 'Modal')).find(node => node.type === 'PressFeedback' && labelOf(node.props.children) === label)!;

const LOCALES: AppLocale[] = ['es-AR', 'en-AR', 'es-US', 'en-US'];

test('the row shows the short date in the interface language and VoiceOver hears it written out', () => {
  const field = harness();
  const expected: Record<AppLocale, [string, string, string]> = {
    'es-AR': ['Fecha', '22 sep 2026', '22 de septiembre de 2026'],
    'en-AR': ['Date', 'Sep 22, 2026', 'September 22, 2026'],
    'es-US': ['Fecha', '22 sep 2026', '22 de septiembre de 2026'],
    'en-US': ['Date', 'Sep 22, 2026', 'September 22, 2026'],
  };
  for (const locale of LOCALES) {
    field.setLocale(locale);
    const row = find(field.render(), 'DetailRow')!;
    assert.deepEqual([row.props.label, row.props.value, row.props.spokenValue], expected[locale], locale);
    assert.equal(row.props.icon, 'calendar-outline');
    assert.equal(row.props.layout, 'inline');
    assert.equal(typeof row.props.onPress, 'function');
  }
});

test('the wheel is a worded date in the language\'s home locale for all four combinations, always the spinner, never the deprecated onChange', () => {
  const field = harness();
  const home: Record<AppLocale, string> = { 'es-AR': 'es_AR', 'en-AR': 'en_US', 'es-US': 'es_AR', 'en-US': 'en_US' };
  for (const locale of LOCALES) {
    field.setLocale(locale);
    const picker = find(field.render(), 'DateTimePicker')!;
    assert.equal(picker.props.mode, 'date', locale);
    assert.equal(picker.props.display, 'spinner', locale + ': inline and compact draw system text that ignores the locale');
    assert.equal(picker.props.locale, home[locale], locale + ': the region never reaches the wheel');
    assert.equal('onChange' in picker.props, false, locale + ': no deprecated onChange, so no LogBox warning in FinanzApp Dev');
    assert.equal(typeof picker.props.onValueChange, 'function');
    assert.equal(typeof picker.props.onDismiss, 'function');
    assert.equal(todayKey(picker.props.value), '2026-09-22', 'the wheel opens on the saved day');
  }
});

test('open, cancel and done: the sheet speaks the interface language, Cancel keeps the saved day, Done saves the spun one', () => {
  const field = harness();
  let root = field.render();
  assert.equal(find(root, 'Modal')!.props.visible, false);
  assert.equal(find(root, 'Modal')!.props.presentationStyle, 'pageSheet');
  find(root, 'DetailRow')!.props.onPress();
  root = field.render();
  assert.equal(find(root, 'Modal')!.props.visible, true);
  assert.deepEqual(bar(root), ['Cancelar', 'Elegir fecha', 'Listo']);
  find(root, 'DateTimePicker')!.props.onValueChange({ nativeEvent: { timestamp: 0, utcOffset: 0 } }, new Date(2026, 8, 18, 12));
  root = field.render();
  assert.equal(todayKey(find(root, 'DateTimePicker')!.props.value), '2026-09-18', 'the wheel moves the draft only');
  button(root, 'Cancelar').props.onPress();
  root = field.render();
  assert.equal(find(root, 'Modal')!.props.visible, false);
  assert.deepEqual(field.saved, [], 'Cancel saves nothing');
  assert.equal(find(root, 'DetailRow')!.props.value, '22 sep 2026', 'the row still shows the saved day');
  // Opening again starts from the saved day, not the abandoned draft.
  find(root, 'DetailRow')!.props.onPress();
  root = field.render();
  assert.equal(todayKey(find(root, 'DateTimePicker')!.props.value), '2026-09-22');
  field.setLocale('en-US');
  root = field.render();
  assert.deepEqual(bar(root), ['Cancel', 'Choose date', 'Done']);
  button(root, 'Done').props.onPress();
  assert.deepEqual(field.saved, ['2026-09-22']);
  assert.equal(find(field.render(), 'Modal')!.props.visible, false);
});

test('a day spun on the wheel survives es-AR → en-AR → es-US → en-US with the sheet open, and Done saves its ISO key', () => {
  const field = harness();
  find(field.render(), 'DetailRow')!.props.onPress();
  find(field.render(), 'DateTimePicker')!.props.onValueChange({ nativeEvent: { timestamp: 0, utcOffset: 0 } }, new Date(2026, 8, 20, 12));
  for (const locale of LOCALES) {
    field.setLocale(locale);
    const root = field.render();
    assert.equal(find(root, 'Modal')!.props.visible, true, locale + ': the sheet stays open');
    const picker = find(root, 'DateTimePicker')!;
    assert.equal(todayKey(picker.props.value), '2026-09-20', locale + ': the spun day is kept');
    assert.equal(picker.props.locale, locale.startsWith('es') ? 'es_AR' : 'en_US');
    assert.equal(find(root, 'DetailRow')!.props.value, locale.startsWith('es') ? '22 sep 2026' : 'Sep 22, 2026', locale + ': the row re-reads the saved day, not the draft');
  }
  assert.deepEqual(field.saved, [], 'nothing is saved while spinning');
  button(field.render(), 'Done').props.onPress();
  assert.deepEqual(field.saved, ['2026-09-20'], 'a day key, never a localized string');
});

test('Android: the system dialog saves on a chosen day and closes either way; there is no sheet', () => {
  const field = harness('android');
  let root = field.render();
  assert.equal(find(root, 'Modal'), undefined, 'no page sheet on Android');
  assert.equal(find(root, 'DateTimePicker'), undefined, 'the dialog is shown only once the row is pressed');
  find(root, 'DetailRow')!.props.onPress();
  root = field.render();
  let picker = find(root, 'DateTimePicker')!;
  assert.equal(picker.props.display, 'default');
  assert.equal('onChange' in picker.props, false);
  picker.props.onDismiss();
  root = field.render();
  assert.equal(find(root, 'DateTimePicker'), undefined, 'dismissed: closed');
  assert.deepEqual(field.saved, [], 'and nothing saved');
  find(root, 'DetailRow')!.props.onPress();
  picker = find(field.render(), 'DateTimePicker')!;
  picker.props.onValueChange({ nativeEvent: { timestamp: 0, utcOffset: 0 } }, new Date(2026, 8, 19, 12));
  assert.deepEqual(field.saved, ['2026-09-19'], 'a chosen day is saved at once');
  assert.equal(find(field.render(), 'DateTimePicker'), undefined, 'and the dialog is closed');
});
