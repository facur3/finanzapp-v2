import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { todayKey } from '@finanzapp/domain';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import * as currenciesModule from '../src/ui/currencies.ts';

// Producto 23.1C2: the real DateField (src/ui/form-controls.tsx) under a
// locale that switches between renders, like the live provider (which never
// remounts its children). The native wheel itself (column order, month
// capitalisation, VoiceOver on the wheel) is a device check; here: what the
// row shows and says, what the picker is given, and that the day the person
// spun survives a language or region change and is saved as an ISO key.
type Node = { type: any; props: Record<string, any> };

function harness(os: 'ios' | 'android' = 'ios', { reduced = true, insets = { top: 59, bottom: 34 }, currencies = {} as Record<string, unknown>, manual = false } = {}) {
  let locale: AppLocale = 'es-AR';
  const source = readFileSync(new URL('../src/ui/form-controls.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  // Hooks persist by call order across renders, like React's, so the sheet and the draft outlive a re-render. Effects run
  // after the render that scheduled them and only when their dependencies changed; a state change inside one re-renders.
  const state: unknown[] = [];
  const deps: unknown[][] = [];
  let cursor = 0, effectCursor = 0, dirty = false;
  let queued: (() => void)[] = [];
  // The animated values, readable by the tests: a timing lands immediately and its completion callback runs at once,
  // or, with `manual`, waits for `settle(finished)` so a test can hold a sheet mid-exit.
  const timings: { to: number; duration: number; easing?: string }[] = [];
  const pending: ((finished: boolean) => void)[] = [];
  const modules: Record<string, unknown> = {
    react: { useMemo: (fn: () => unknown) => fn(), useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial;
      return [state[index], (value: unknown) => { if (state[index] !== value) dirty = true; state[index] = value; }]; },
    useRef: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = { current: initial }; return state[index]; },
    useEffect: (fn: () => void, next?: unknown[]) => { const index = effectCursor++; const previous = deps[index];
      if (!previous || !next || next.length !== previous.length || next.some((item, i) => item !== previous[i])) { deps[index] = next ?? []; queued.push(fn); } } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { FlatList: 'FlatList', Keyboard: { dismiss() {} }, Modal: 'Modal', Platform: { OS: os }, Pressable: 'Pressable', StyleSheet: { absoluteFill: 'absoluteFill' }, View: 'View',
      useWindowDimensions: () => ({ width: 393, height: 852 }) },
    // A shared value persists across renders by call order, like a hook.
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: (value: unknown) => { const index = cursor++; if (!(index in state)) state[index] = { value }; return state[index]; },
      useAnimatedStyle: (fn: () => unknown) => fn(), runOnJS: (fn: (...args: unknown[]) => void) => fn,
      withTiming: (to: number, config: { duration: number; easing?: string }, callback?: (finished: boolean) => void) => {
        timings.push(config.easing === undefined ? { to, duration: config.duration } : { to, duration: config.duration, easing: config.easing });
        if (callback) { if (manual) pending.push(callback); else callback(true); }
        return to;
      } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => insets },
    '@react-native-community/datetimepicker': 'DateTimePicker',
    '@expo/vector-icons/Ionicons': 'Ionicons',
    // The real day key: local calendar fields, never toISOString (UTC), exactly what the forms store.
    '@finanzapp/domain': { todayKey },
    '../i18n/provider': { useI18n: () => bindLocale(locale) },
    './components': { AccountBadge: 'AccountBadge', AppText: 'AppText', CategoryBadge: 'CategoryBadge', DetailRow: 'DetailRow', SelectionRow: 'SelectionRow', Field: 'Field',
      GlyphTile: 'GlyphTile', PressFeedback: 'PressFeedback', Surface: 'Surface', surfaceShadow: () => ({}) },
    './currencies': currencies, './category-hues': {}, './categories': {}, './motion': { selectionHaptic: () => {}, timing: (kind: string, reducedMotion: boolean) => ({ duration: reducedMotion ? 0 : kind === 'exit' ? 100 : 200 }),
      // The sheet's own timings (24UX1): a duration under Reduce Motion too (a timed fade), the iOS sheet curve when the card moves.
      sheetTiming: (kind: string, reducedMotion: boolean) => ({ duration: kind === 'sheetExit' ? 200 : 300, easing: reducedMotion ? 'easeOut' : 'easeSheet' }) },
    './theme': { radius: { group: 16, sheet: 24 }, space: { xs: 4, s: 8, m: 12, l: 16, xl: 20 },
      usePalette: () => ({ isDark: false, primary: '#2557D6', background: '#F2F2F6', surface: '#FFFFFF', line: '#E6E6EC', scrim: 'rgba(10, 10, 12, 0.32)' }), useReduceMotion: () => reduced },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected form-controls dependency: ' + name);
    return modules[name];
  } });
  const saved: string[] = [];
  const props = { value: new Date(2026, 8, 22, 12), onChange: (date: Date) => saved.push(todayKey(date)) };
  const render = (component = 'DateField', ownProps: any = props) => {
    for (let pass = 0; pass < 4; pass++) {
      cursor = 0; effectCursor = 0; dirty = false; queued = [];
      const root = module.exports[component]!(ownProps);
      // Rendering the local sheet component in place queues its effects too.
      nodes(root);
      for (const effect of queued) effect();
      if (!dirty) return root;
    }
    throw new Error('the tree never settled');
  };
  /** Ends the oldest unfinished timing, as Reanimated would: finished, or interrupted by a newer one. */
  const settle = (finished: boolean) => { const callback = pending.shift(); if (!callback) throw new Error('no timing to settle'); callback(finished); };
  return { render, saved, timings, settle, pendingCount: () => pending.length, setLocale: (next: AppLocale) => { locale = next; } };
}

/** Every node, with local function components (the sheet) rendered in place. */
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  // A local component is rendered once per element, so walking the tree twice never re-runs its hooks.
  if (typeof value.type === 'function' && !('rendered' in value)) value.rendered = value.type(value.props);
  return [value, ...('rendered' in value ? nodes(value.rendered) : []), ...nodes(value.props.children)];
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
  assert.equal(find(root, 'Modal')!.props.transparent, true, '24B6: a compact bottom sheet over a scrim, not a page sheet');
  assert.equal('presentationStyle' in find(root, 'Modal')!.props, false);
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

// ---- Producto 24B6: the compact bottom sheet --------------------------------------------------------------

/** The sheet's parts on iOS: the scrim, the card and the wheel's container. */
function sheet(root: Node) {
  const modal = find(root, 'Modal')!;
  const animated = nodes(modal).filter(node => node.type === 'Animated.View');
  const [scrim, card] = animated;
  const flat = (style: any): Record<string, any> => Object.assign({}, ...[style].flat(Infinity).filter(item => item && typeof item === 'object'));
  return { modal, scrim, card, scrimStyle: flat(scrim?.props.style), cardStyle: flat(card?.props.style),
    wheelBox: nodes(card).find(node => node.type === 'View' && node.props.children?.type === 'DateTimePicker')! };
}
/** What iOS does after the modal mounts: lays the card out (its height) and presents the modal (`onShow`), in either order. */
function present(root: Node, height = 360, order: 'layout-first' | 'show-first' = 'layout-first') {
  const { modal, card } = sheet(root);
  const layout = () => card.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 393, height } } });
  if (order === 'layout-first') { layout(); modal.props.onShow(); } else { modal.props.onShow(); layout(); }
}

test('24B6: the date wheel opens in a compact bottom sheet sized to its content, not a page sheet: a scrim, a card with the header and the wheel centred, the home-indicator inset below', () => {
  const field = harness('ios', { reduced: false });
  find(field.render(), 'DetailRow')!.props.onPress();
  present(field.render());
  const root = field.render();
  const { modal, scrim, card, scrimStyle, cardStyle, wheelBox } = sheet(root);
  assert.equal(modal.props.visible, true);
  assert.equal(modal.props.transparent, true, 'the form stays visible behind the scrim');
  assert.equal(modal.props.animationType, 'none', 'the sheet animates itself: the scrim fades while the card rises');
  assert.equal(typeof modal.props.onRequestClose, 'function', 'the system back gesture cancels');
  assert.deepEqual(scrimStyle, { backgroundColor: 'rgba(10, 10, 12, 0.32)', opacity: 1 }, 'the scrim is the palette token, fully shown once open');
  assert.equal(scrim.props.style[0], 'absoluteFill');
  const scrimPress = nodes(scrim).find(node => node.type === 'Pressable')!;
  assert.equal(scrimPress.props.accessible, false, 'VoiceOver never lands on the scrim');
  assert.equal(card.props.accessibilityViewIsModal, true, 'VoiceOver stays inside the card');
  assert.equal(cardStyle.borderTopLeftRadius, 24);
  assert.equal(cardStyle.borderTopRightRadius, 24);
  assert.equal(cardStyle.backgroundColor, '#FFFFFF');
  assert.equal(cardStyle.paddingBottom, 34, 'the home-indicator inset, from the safe area, not a constant');
  assert.equal(cardStyle.opacity, 1);
  assert.equal(JSON.stringify(cardStyle.transform), '[{"translateY":0}]', 'open: the card rests at the bottom edge');
  assert.deepEqual(bar(root), ['Cancelar', 'Elegir fecha', 'Listo'], 'the header inside the card, in the drawn order');
  assert.equal(nodes(card).find(node => node.type === 'AppText' && labelOf(node) === 'Elegir fecha')!.props.accessibilityRole, 'header');
  assert.equal(wheelBox.props.style.alignItems, 'center', 'the wheel is centred in the card');
  assert.equal(wheelBox.props.style.alignSelf, 'stretch');
  const picker = find(root, 'DateTimePicker')!;
  assert.equal(JSON.stringify(picker.props.style), '{"width":"100%"}');
  assert.equal(picker.props.display, 'spinner');
  assert.equal(picker.props.themeVariant, 'light');
  assert.equal(todayKey(picker.props.minimumDate), '1900-01-01', 'the lower bound is kept');
  assert.equal(todayKey(picker.props.maximumDate), todayKey(new Date()), 'no future date without allowFuture');
  assert.equal(nodes(root).some(node => node.type === 'SafeAreaView'), false, 'no full-height safe-area page: the inset is applied to the card itself');
  // The scrim cancels like the Cancel button: nothing saved, the wheel's draft dropped.
  picker.props.onValueChange({ nativeEvent: { timestamp: 0, utcOffset: 0 } }, new Date(2026, 8, 3, 12));
  scrimPress.props.onPress();
  const closed = field.render();
  assert.equal(find(closed, 'Modal')!.props.visible, false, 'unmounted once the exit finished');
  assert.deepEqual(field.saved, []);
  find(closed, 'DetailRow')!.props.onPress();
  assert.equal(todayKey(find(field.render(), 'DateTimePicker')!.props.value), '2026-09-22', 'reopened on the saved day');
});

test('24UX1: the rise starts only once the modal is on screen and the card measured; until then the card rests below the window and the scrim is clear', () => {
  const field = harness('ios', { reduced: false, insets: { top: 20, bottom: 0 } });
  find(field.render(), 'DetailRow')!.props.onPress();
  let root = field.render();
  let s = sheet(root);
  assert.equal(s.modal.props.visible, true, 'the modal mounts first');
  assert.equal(typeof s.modal.props.onShow, 'function', 'and says when iOS has presented it');
  assert.deepEqual(field.timings, [], 'no timing runs before the card can be seen: the 24B6 entrance started here, one to four frames before the modal was presented, and the ease-out curve had covered most of the rise by the first painted frame');
  assert.equal(JSON.stringify(s.cardStyle.transform), '[{"translateY":852}]', 'unmeasured: a window height below the edge, off screen whatever the card\'s height');
  assert.equal(s.scrimStyle.opacity, 0);
  assert.equal(s.cardStyle.opacity, 1);
  s.card.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 420 } } });
  root = field.render(); s = sheet(root);
  assert.deepEqual(field.timings, [], 'measured but not yet presented: still waiting');
  assert.equal(JSON.stringify(s.cardStyle.transform), '[{"translateY":420}]', 'exactly its own height below the edge');
  s.modal.props.onShow();
  root = field.render(); s = sheet(root);
  assert.deepEqual(field.timings, [{ to: 1, duration: 300, easing: 'easeSheet' }], 'presented and measured: the rise, on the iOS sheet curve, 300 ms');
  assert.equal(JSON.stringify(s.cardStyle.transform), '[{"translateY":0}]', 'open: the card rests at the bottom edge');
  assert.equal(s.scrimStyle.opacity, 1, 'the scrim follows the same progress');
  assert.equal(s.cardStyle.paddingBottom, 12, 'a minimum inset below the wheel when the safe area has none');
  button(root, 'Listo').props.onPress();
  root = field.render();
  assert.deepEqual(field.timings.at(-1), { to: 0, duration: 200, easing: 'easeSheet' }, 'the exit is shorter than the entrance');
  assert.equal(find(root, 'Modal')!.props.visible, false, 'unmounted once the exit finished');
  assert.deepEqual(field.saved, ['2026-09-22']);

  // Presented before measured (the other order iOS may take): the rise waits for the measurement too.
  const other = harness('ios', { reduced: false });
  find(other.render(), 'DetailRow')!.props.onPress();
  root = other.render();
  sheet(root).modal.props.onShow();
  root = other.render();
  assert.deepEqual(other.timings, [], 'presented but unmeasured: the rise would start from a guessed height and jump when measured');
  sheet(root).card.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 380 } } });
  root = other.render();
  assert.deepEqual(other.timings, [{ to: 1, duration: 300, easing: 'easeSheet' }]);
  assert.equal(JSON.stringify(sheet(root).cardStyle.transform), '[{"translateY":0}]');
});

test('24UX1: the card stays mounted while it leaves; a reopen mid-exit reverses at once without a new presentation; an interrupted exit never unmounts; a finished one always does', () => {
  const field = harness('ios', { reduced: false, manual: true });
  find(field.render(), 'DetailRow')!.props.onPress();
  present(field.render(), 400);
  let root = field.render();
  assert.equal(field.pendingCount(), 0, 'a rise has no completion to wait for: only an exit decides an unmount');
  button(root, 'Cancelar').props.onPress();
  root = field.render();
  assert.deepEqual(field.timings.at(-1), { to: 0, duration: 200, easing: 'easeSheet' });
  assert.equal(find(root, 'Modal')!.props.visible, true, 'still mounted while the exit runs: nothing snaps away');
  // Reopened before the exit ended: the same presented modal rises again, no onShow needed, and the old exit is interrupted.
  find(root, 'DetailRow')!.props.onPress();
  root = field.render();
  assert.deepEqual(field.timings.at(-1), { to: 1, duration: 300, easing: 'easeSheet' }, 'the rise restarts from wherever the card was');
  field.settle(false); // Reanimated ends the interrupted exit with finished=false
  root = field.render();
  assert.equal(find(root, 'Modal')!.props.visible, true, 'an interrupted exit never unmounts the card that is rising again');
  assert.equal(JSON.stringify(sheet(root).cardStyle.transform), '[{"translateY":0}]');
  button(root, 'Listo').props.onPress();
  root = field.render();
  assert.equal(find(root, 'Modal')!.props.visible, true, 'the exit runs before the modal goes');
  field.settle(true);
  root = field.render();
  assert.equal(find(root, 'Modal')!.props.visible, false, 'a finished exit unmounts: no invisible modal is left over the form');
  assert.equal(field.pendingCount(), 0);
  assert.deepEqual(field.saved, ['2026-09-22']);
  // The next opening waits for the new presentation again: nothing rises on a modal that is not on screen.
  find(root, 'DetailRow')!.props.onPress();
  root = field.render();
  assert.deepEqual(field.timings.at(-1), { to: 0, duration: 200, easing: 'easeSheet' }, 'no new timing yet: the last one is still the exit');
  assert.equal(field.timings.length, 4, 'rise, exit, rise, exit');
  assert.equal(JSON.stringify(sheet(root).cardStyle.transform), '[{"translateY":400}]', 'the measured height is kept: off screen at once');
  present(root, 400, 'show-first');
  assert.equal(field.timings.length, 5);
});

test('24UX1: a close before the modal is on screen leaves nothing behind, and a late onShow raises nothing', () => {
  const field = harness('ios', { reduced: false, manual: true });
  find(field.render(), 'DetailRow')!.props.onPress();
  let root = field.render();
  const { modal, card } = sheet(root);
  button(root, 'Cancelar').props.onPress();
  root = field.render();
  assert.deepEqual(field.timings, [{ to: 0, duration: 200, easing: 'easeSheet' }], 'the exit runs from where the card is (below the edge)');
  field.settle(true);
  root = field.render();
  assert.equal(find(root, 'Modal')!.props.visible, false, 'gone: no transparent modal blocking the form');
  card.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 400 } } });
  modal.props.onShow(); // iOS may still deliver the presentation of the modal that was already dismissed
  root = field.render();
  assert.equal(field.timings.length, 1, 'a stale presentation starts no rise');
  assert.equal(find(root, 'Modal')!.props.visible, false);
  assert.deepEqual(field.saved, []);
});

test('24UX1: Reduce Motion: a timed fade with no displacement, invisible until the modal is on screen', () => {
  const field = harness('ios', { reduced: true });
  find(field.render(), 'DetailRow')!.props.onPress();
  let root = field.render();
  let s = sheet(root);
  assert.deepEqual(field.timings, [], 'nothing before the presentation');
  assert.equal(JSON.stringify(s.cardStyle.transform), '[{"translateY":0}]', 'the card never travels');
  assert.equal(s.cardStyle.opacity, 0, 'it is clear until it fades in');
  assert.equal(s.scrimStyle.opacity, 0);
  present(root);
  root = field.render(); s = sheet(root);
  assert.deepEqual(field.timings, [{ to: 1, duration: 300, easing: 'easeOut' }], 'Reduce Motion: a fade with a duration, not an instant appearance (24B6 wrote a zero-length timing here)');
  assert.equal(s.cardStyle.opacity, 1);
  assert.equal(s.scrimStyle.opacity, 1);
  assert.equal(JSON.stringify(s.cardStyle.transform), '[{"translateY":0}]');
  button(root, 'Cancelar').props.onPress();
  root = field.render();
  assert.deepEqual(field.timings.at(-1), { to: 0, duration: 200, easing: 'easeOut' }, 'and a timed fade out');
  assert.equal(find(root, 'Modal')!.props.visible, false);
});

test('24B6: the list sheets keep their page-sheet geometry: only the date field changed', () => {
  const field = harness('ios', { currencies: currenciesModule });
  const root = field.render('CurrencyField', { value: 'ARS', onChange: () => {}, currencies: ['ARS', 'USD'] });
  const modal = find(root, 'Modal')!;
  assert.equal(modal.props.presentationStyle, 'pageSheet');
  assert.equal(modal.props.allowSwipeDismissal, true);
  assert.equal(nodes(root).some(node => node.type === 'SafeAreaView'), true);
});
