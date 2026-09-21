import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { carouselIndex, segmentLayout } from '../src/ui/geometry.ts';
import { assignCategoryHues, categoryColor, hueColor, othersColor, CATEGORY_HUES } from '../src/ui/category-color.ts';
import type { Entry } from '@finanzapp/domain';

// Pure geometry and colour rules behind the animated controls. Motion feel,
// haptic timing and frame pacing remain physical-device acceptance items.

test('segmented thumb covers equal segments and clamps the index', () => {
  const two = segmentLayout(232, 2, 1);
  assert.equal(two.width, (232 - 4 - 2) / 2);
  assert.equal(two.offset, 2 + two.width + 2);
  assert.deepEqual(segmentLayout(232, 2, 0), { width: two.width, offset: 2 });
  assert.equal(segmentLayout(300, 4, 3).offset + segmentLayout(300, 4, 3).width, 300 - 2, 'last segment ends at the track padding');
  assert.equal(segmentLayout(232, 2, -1).offset, 2, 'an unknown value keeps the thumb on the first segment');
  assert.equal(segmentLayout(232, 2, 5).offset, two.offset);
  assert.deepEqual(segmentLayout(0, 2, 1), { width: 0, offset: 0 }, 'nothing to draw before layout');
});

test('carousel index follows the settled offset within bounds', () => {
  assert.equal(carouselIndex(0, 365, 3), 0);
  assert.equal(carouselIndex(360, 365, 3), 1);
  assert.equal(carouselIndex(200, 365, 3), 1, 'past the midpoint counts as the next card');
  assert.equal(carouselIndex(5000, 365, 3), 2);
  assert.equal(carouselIndex(-40, 365, 3), 0, 'rubber-band overscroll stays on the first card');
  assert.equal(carouselIndex(100, 0, 3), 0);
});

const createdAt = '2026-09-12T12:00:00Z';
const entry = (id: string, category: string, dateISO: string, kind: 'expense' | 'income' = 'expense'): Entry =>
  ({ id, accountId: 'a', kind, amountMinor: 100, merchant: 'x', category, dateISO, createdAt });

test('category hues are stable, distinct while they can be, and independent of spelling', () => {
  const entries = [entry('1', 'Comida', '2026-08-01'), entry('2', 'Salud', '2026-08-02'), entry('3', 'COMIDA', '2026-09-01'), entry('4', 'Sueldo', '2026-09-01', 'income')];
  const hues = assignCategoryHues(entries);
  assert.deepEqual([...hues.keys()].sort(), ['comida', 'salud'], 'only expense categories, keyed once');
  assert.equal(hues.get('comida'), assignCategoryHues(entries.slice().reverse()).get('comida'), 'entry order does not matter');
  const p = { isDark: false };
  assert.equal(categoryColor('comida', hues, p), categoryColor('COMIDA', assignCategoryHues(entries), p));
  assert.notEqual(categoryColor('comida', hues, { isDark: true }), categoryColor('comida', hues, p), 'dark mode has its own variant');
  // Eight categories take eight different hues; the ninth repeats one.
  const many = Array.from({ length: 9 }, (_, index) => entry(String(index), 'Categoría ' + index, '2026-08-0' + ((index % 9) + 1)));
  const spread = assignCategoryHues(many);
  assert.equal(new Set([...spread.values()].slice(0, CATEGORY_HUES)).size, CATEGORY_HUES);
  // Adding a new category later never changes the hue of an existing one.
  const later = assignCategoryHues([...many, entry('new', 'Nueva', '2026-09-15')]);
  for (const [key, hue] of spread) assert.equal(later.get(key), hue, key + ' keeps its hue');
  assert.equal(othersColor(p), othersColor({ isDark: false }));
  assert.equal(hueColor(CATEGORY_HUES + 1, p), hueColor(1, p));
});

test('donut sweeps in from twelve o\'clock only the first time, then crossfades, and skips motion when reduced', () => {
  const source = readFileSync(new URL('../src/ui/charts.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  let reduced = false;
  const shared: { value: number }[] = [];
  const timings: number[] = [];
  const modules: Record<string, any> = {
    react: { useEffect: (fn: () => any) => { fn(); }, useMemo: (fn: () => any) => fn(), useRef: (value: any) => ({ current: value }) },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', StyleSheet: { absoluteFill: {}, hairlineWidth: 0.5 } },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView', Text: 'AnimatedText', createAnimatedComponent: (c: any) => 'Animated(' + c + ')' },
      useSharedValue: (value: number) => { const item = { value }; shared.push(item); return item; }, useAnimatedStyle: (fn: () => any) => fn,
      useAnimatedProps: (fn: () => any) => fn,
      withTiming: (value: number, options: { duration: number }) => { timings.push(options.duration); return value; } },
    'react-native-svg': { __esModule: true, default: 'Svg', Circle: 'Circle', Path: 'Path' },
    './components': { AppText: 'AppText', Money: 'Money', PressFeedback: 'PressFeedback' },
    './category-color': { categoryColor: () => '#111', othersColor: () => '#ccc' },
    './motion': { ValueTransition: 'ValueTransition', duration: { state: 200, data: 260, reveal: 480 }, timing: (kind: string, isReduced: boolean) => ({ duration: isReduced ? 0 : kind === 'reveal' ? 480 : 260 }) },
    './theme': { useReduceMotion: () => reduced, usePalette: () => ({ inset: '#eee', text: '#000', secondary: '#666' }) },
  };
  const module = { exports: {} as { DonutChart?: (props: any) => any } };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected chart dependency: ' + name);
    return modules[name];
  } });
  const slices = [{ key: 'a', label: 'A', value: 300, color: '#1' }, { key: 'b', label: 'B', value: 100, color: '#2' }];
  const render = (revealed = false) => {
    modules.react.useRef = () => ({ current: revealed });
    const chart = module.exports.DonutChart!({ slices, total: 400, currency: 'ARS', caption: 'Total' });
    const sweep = chart.props.children[0].props.children;
    const svg = sweep.type(sweep.props);
    return { chart, paths: svg.props.children[1].filter(Boolean).map((slice: any) => slice.type(slice.props)) };
  };
  const { chart, paths } = render();
  assert.equal(chart.type, 'ValueTransition', 'new data crossfades instead of flashing to empty');
  assert.match(chart.props.children[0].props.accessibilityLabel, /A 75 %, B 25 %/);
  assert.equal(shared.at(-1)!.value, 1, 'a finished chart is the animation target');
  assert.equal(timings.at(-1), 480);
  const progress = shared.at(-1)!;
  const finished = paths.map((path: any) => path.props.d);
  assert.ok(finished.every((d: string) => d.startsWith('M ')), 'the static path is the finished arc');
  progress.value = 0;
  assert.deepEqual(paths.map((path: any) => path.props.animatedProps().d), ['', ''], 'nothing is drawn before the hand moves');
  progress.value = 0.5;
  const halfway = paths.map((path: any) => path.props.animatedProps().d);
  assert.notEqual(halfway[0], finished[0], 'the first slice is still being drawn at half a turn');
  assert.equal(halfway[1], '', 'the second slice waits for the hand');
  progress.value = 1;
  assert.deepEqual(paths.map((path: any) => path.props.animatedProps().d), finished);
  const again = render(true);
  assert.equal(shared.at(-1)!.value, 1, 'a later month change crossfades with the slices already final');
  assert.equal(again.chart.type, 'ValueTransition');
  reduced = true;
  const still = render();
  assert.equal(shared.at(-1)!.value, 1, 'reduced motion shows the finished chart at once');
  assert.deepEqual(still.paths.map((path: any) => path.props.animatedProps().d), still.paths.map((path: any) => path.props.d));
});

test('quick actions open the three movement modes with the account and currency carried over', () => {
  const source = readFileSync(new URL('../src/ui/quick-actions.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const pushed: any[] = [];
  const modules: Record<string, any> = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View' },
    'expo-router': { router: { push: (to: unknown) => pushed.push(to) } },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    './components': { AppText: 'AppText', PressFeedback: 'PressFeedback', toneColors: (_p: unknown, tone: string) => ({ color: tone, soft: tone + '-soft' }) },
    './theme': { space: { xxxl: 32 }, usePalette: () => ({ secondary: '#666' }) },
  };
  const module = { exports: {} as { QuickActions?: (props: any) => any } };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected quick-actions dependency: ' + name);
    return modules[name];
  } });
  const row = module.exports.QuickActions!({ currency: 'USD', accountId: 'a' });
  const actions = row.props.children.map((child: any) => child.type(child.props));
  assert.equal(JSON.stringify(actions.map((action: any) => action.props.accessibilityLabel)), JSON.stringify(['Registrar gasto', 'Registrar ingreso', 'Transferir entre cuentas']));
  actions.forEach((action: any) => action.props.onPress());
  assert.equal(JSON.stringify(pushed), JSON.stringify([
    { pathname: '/new-entry', params: { kind: 'expense', accountId: 'a', currency: 'USD' } },
    { pathname: '/new-entry', params: { kind: 'income', accountId: 'a', currency: 'USD' } },
    { pathname: '/new-transfer', params: { accountId: 'a' } },
  ]));
  // Each tile carries its semantic tone in the glyph and its soft background: expense coral, income green, transfer blue.
  const tiles = actions.map((action: any) => action.props.children[0].props.style.backgroundColor);
  assert.equal(JSON.stringify(tiles), JSON.stringify(['expense-soft', 'income-soft', 'transfer-soft']));
});

test('form selectors keep the category hue and give the account the interaction accent', () => {
  const source = readFileSync(new URL('../src/ui/form-controls.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const state: unknown[] = [];
  let cursor = 0;
  const modules: Record<string, any> = {
    react: { useMemo: (fn: () => unknown) => fn(), useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial;
      return [state[index], (value: unknown) => { state[index] = value; }]; } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { FlatList: 'FlatList', Keyboard: { dismiss() {} }, Modal: 'Modal', Platform: { OS: 'ios' }, View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@react-native-community/datetimepicker': 'DateTimePicker',
    '@expo/vector-icons/Ionicons': 'Ionicons',
    './components': { AppText: 'AppText', CategoryBadge: 'CategoryBadge', DetailRow: 'DetailRow', Field: 'Field', GlyphTile: 'GlyphTile', PressFeedback: 'PressFeedback', surfaceShadow: () => ({}) },
    './category-hues': { useCategoryColor: (label: string) => label ? '#B0507A' : '#000' },
    './motion': { selectionHaptic: () => {} },
    './theme': { radius: { group: 16 }, usePalette: () => ({ surface: '#fff', text: '#000', primary: '#2557D6', primarySoft: '#E5ECFB', secondary: '#666', tertiary: '#999', background: '#fff', isDark: false }), useReduceMotion: () => true },
    './categories': { categoryChoices: () => [], categoryIcon: () => 'paw-outline', categoryKey: (label: string) => label.toLowerCase(), customCategory: () => null },
  };
  const module = { exports: {} as Record<string, (props: any) => any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected form-controls dependency: ' + name);
    return modules[name];
  } });
  const render = (component: string, props: any) => { cursor = 0; state.length = 0; let node = module.exports[component](props); while (typeof node.type === 'function') node = node.type(node.props); return node; };
  const selector = (node: any) => { let card = node.props.children[0]; while (typeof card.type === 'function') card = card.type(card.props); return card; };
  const tileOf = (card: any) => card.props.children[0];
  const chosen = selector(render('CategoryField', { entries: [], kind: 'expense', value: 'Mascotas', onChange: () => {}, prominent: true }));
  assert.equal(tileOf(chosen).props.color, '#B0507A', 'the chosen expense category shows its own hue');
  assert.equal(tileOf(chosen).props.icon, 'paw-outline');
  const empty = selector(render('CategoryField', { entries: [], kind: 'expense', value: '', onChange: () => {}, prominent: true }));
  assert.equal(tileOf(empty).props.color, undefined, 'no hue before a category is chosen');
  const income = selector(render('CategoryField', { entries: [], kind: 'income', value: 'Sueldo', onChange: () => {}, prominent: true }));
  assert.equal(tileOf(income).props.color, undefined);
  assert.equal(tileOf(income).props.tone, 'income', 'income keeps its meaning over the hue');
  const accounts = [{ id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: '' }];
  const account = selector(render('AccountField', { accounts, value: 'a', onChange: () => {}, prominent: true }));
  assert.equal(tileOf(account).props.color, '#2557D6', 'a chosen account takes the brand primary, not the transfer semantic');
  assert.equal(tileOf(account).props.tone, 'neutral');
  const none = selector(render('AccountField', { accounts, value: '', onChange: () => {}, prominent: true }));
  assert.equal(tileOf(none).props.color, undefined);
  assert.equal(tileOf(none).props.tone, 'neutral');
});
