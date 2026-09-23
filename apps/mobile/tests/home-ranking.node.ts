import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as presentation from '../src/ui/report-presentation.ts';
import * as budgetPresentation from '../src/ui/budget-presentation.ts';
import { washOf } from '../src/ui/category-color.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
const i18nProvider = { useI18n: () => bindLocale('es-AR') };

// A source/behaviour guard over the Home category module: honest proportions,
// a reveal that runs once, interpolation on data changes and Reduce Motion.
// Frame pacing and the look of the tinted fill remain device acceptance items.
type Shared = { value: unknown };

function harness() {
  const source = readFileSync(new URL('../src/ui/home-modules.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  // Hooks persist by call order across renders, like React's, so a re-render keeps its refs and shared values.
  const env = { reduced: false, shared: [] as (Shared & { initial: unknown })[], refs: [] as { current: unknown }[], cursor: { shared: 0, ref: 0 } };
  const modules: Record<string, any> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useEffect: (fn: () => any) => { fn(); }, useRef: (value: unknown) => {
      const index = env.cursor.ref++;
      return env.refs[index] ??= { current: value }; } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Alert: {}, StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 }, View: 'View', useWindowDimensions: () => ({ fontScale: 1 }) },
    'expo-router': { router: {} },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' },
      useSharedValue: (value: unknown) => { const index = env.cursor.shared++; return env.shared[index] ??= { value, initial: value }; },
      useAnimatedStyle: (fn: () => any) => fn,
      withTiming: (value: number, options: { duration: number }) => ({ value, duration: options.duration, delay: 0 }),
      withDelay: (delay: number, animation: { value: number; duration: number }) => ({ ...animation, delay }) },
    '@finanzapp/domain': { formatMinorUnits: (minor: number) => String(minor), labelFromISO: () => '' },
    './components': { AppText: 'AppText', CategoryBadge: 'CategoryBadge', Money: 'Money', PressFeedback: 'PressFeedback', Surface: 'Surface', useStacked: () => false },
    './category-color': { washOf },
    './category-hues': { useCategoryColor: (label: string) => '#' + label.length.toString().padStart(6, 'A'), useCategoryLook: (label: string) => ({ label, hex: '#' + label.length.toString().padStart(6, 'A'), glyph: 'pricetag-outline' }) },
    './motion': { easeOut: 'ease-out', timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) },
    './report-presentation': presentation,
    './budget-presentation': budgetPresentation,
    './theme': { useReduceMotion: () => env.reduced, usePalette: () => ({ line: '#ddd', isDark: true }) },
  };
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected home-modules dependency: ' + name);
    return modules[name];
  } });
  const render = (props: any) => {
    env.cursor.shared = 0; env.cursor.ref = 0;
    const group = module.exports.CategoryRanking(props);
    return { group, rows: group.props.children.map((row: any) => { const node = row.type(row.props); return node; }) };
  };
  const renderBudget = (summary: any) => { env.cursor.shared = 0; env.cursor.ref = 0; return module.exports.BudgetHomeCard({ summary }); };
  return { env, render, renderBudget };
}
function flatten(value: any): any[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (!value.props) return [];
  return [value, ...flatten(value.props.children)];
}

const category = (key: string, amountMinor: number) => ({ key, category: key, amountMinor, count: 1 });

test('rows fill in proportion to real spending, with no invented minimum and no percentage copy', () => {
  const { env, render } = harness();
  const categories = [category('comida', 99800), category('ocio', 100), category('salud', 100)];
  const { group, rows } = render({ categories, totalMinor: 100000, currency: 'ARS', onPressCategory: () => {} });
  assert.equal(group.type, 'Surface'); assert.equal(group.props.grouped, true, 'one grouped block, not floating cards');
  assert.equal(rows.length, 3);
  const progress = env.shared.filter((_, index) => index % 2 === 0);
  assert.deepEqual(progress.map(item => item.initial), [0, 0, 0], 'the first frame starts empty and animates up');
  assert.deepEqual(progress.map(item => (item.value as any).value), [0.998, 0.001, 0.001], 'the animation targets are the honest shares');
  // The style maps the share straight to a width: 0,1 % is a hairline, never a padded minimum.
  const fillOf = (row: any) => row.props.backdrop.props.children;
  progress[1].value = 0.001;
  assert.equal(fillOf(rows[1]).props.style[2]().width, '0.1%');
  progress[0].value = 0.998;
  assert.equal(fillOf(rows[0]).props.style[2]().width, '99.8%');
  for (const row of rows) {
    assert.equal(row.props.accessibilityRole, 'button', 'a tiny share is still a full tappable row');
    assert.equal(row.props.backdrop.props.pointerEvents, 'none', 'the wash never intercepts the tap');
    const track = row.props.backdrop.props.style;
    assert.equal(track.position, 'absolute', 'the wash is out of flow: no layout cost');
    assert.ok(track.left > 0 && track.right > 0 && track.top > 0 && track.bottom > 0, 'the wash is inset from the row, a rounded shape of its own');
    assert.ok(fillOf(row).props.style[0].borderRadius >= 10, 'rounded, never cut square by the surface edge');
    assert.equal(row.props.children[0].type, 'CategoryBadge', 'the category is the glyph on its hue, no emoji');
    assert.equal(row.props.style[0].borderBottomWidth, undefined, 'no separator cuts through the wash');
  }
  assert.match(rows[1].props.accessibilityLabel, /ocio, 100 ARS, 0,1\u00A0% del gasto del mes/);
  assert.equal(fillOf(rows[0]).props.style[1].backgroundColor, washOf('#AAAAA6', { isDark: true }), 'the wash is a faint tenth of the category hue');
  assert.equal(washOf('#AAAAA6', { isDark: true }), '#AAAAA61C');
  assert.equal(washOf('#AAAAA6', { isDark: false }), '#AAAAA614');
  const texts = JSON.stringify(rows);
  assert.equal(/%/.test(texts.replace(/accessibilityLabel[^,]*,[^,]*,[^"]*"/g, '')), false, 'no visible percentage labels');
});

test('the reveal grows each fill from zero with a 50 ms stagger, then later data interpolates without delay', () => {
  const { env, render } = harness();
  const draw = (amount: number) => render({ categories: [category('a', 500), category('b', amount)], totalMinor: 1000, currency: 'ARS', onPressCategory: () => {} });
  draw(500);
  const second = env.shared[2];
  assert.deepEqual(second.value, { value: 0.5, duration: 300, delay: 50 }, 'second row: 300 ms ease-out after a 50 ms stagger');
  assert.deepEqual(env.shared[0].value, { value: 0.5, duration: 300, delay: 0 }, 'first row: no delay');
  assert.ok(env.refs.every(ref => ref.current === true), 'the reveal is remembered so it never replays');
  draw(250);
  assert.deepEqual(second.value, { value: 0.25, duration: 260, delay: 0 }, 'a data change moves from the previous share in the shared data duration');
  draw(250);
  assert.deepEqual(second.value, { value: 0.25, duration: 260, delay: 0 }, 'same data, same target: nothing replays from zero');
});

test('Reduce Motion skips the width motion: the fill starts at its final share and only fades in', () => {
  const { env, render } = harness();
  env.reduced = true;
  render({ categories: [category('a', 300)], totalMinor: 1000, currency: 'ARS', onPressCategory: () => {} });
  const [progress, opacity] = env.shared;
  assert.equal(progress.value, 0.3, 'no width animation: the proportion is final at once');
  assert.deepEqual(opacity.value, { value: 1, duration: 200, delay: 0 }, 'a short opacity change explains the appearance');
});

test('Home shows at most three ranked categories', () => {
  const { render } = harness();
  const categories = Array.from({ length: 6 }, (_, index) => category('c' + index, 100));
  assert.equal(render({ categories, totalMinor: 600, currency: 'ARS', onPressCategory: () => {} }).rows.length, 3);
});

const budgetAt = '2026-09-01T12:00:00.000Z';
const totalBudget = { id: 't', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 50000000, active: true, createdAt: budgetAt, revision: 0, updatedAt: budgetAt };
const progress = (budget: any, spentMinor: number) => ({ budget, spentMinor, remainingMinor: budget.amountMinor - spentMinor, ratio: spentMinor / budget.amountMinor, exceeded: spentMinor > budget.amountMinor });
const foodRow = progress({ ...totalBudget, id: 'f', scope: 'category', category: 'Comida', amountMinor: 15000000 }, 12000000);
const funRow = progress({ ...totalBudget, id: 'o', scope: 'category', category: 'Ocio', amountMinor: 5000000 }, 5500000);

test('the Home budget card leads with the general budget and its share used, and counts sublimits without adding them', () => {
  const { renderBudget } = harness();
  const summary = { currency: 'ARS', monthISO: '2026-09', total: progress(totalBudget, 32000000), rows: [funRow, foodRow],
    budgetedMinor: 20000000, spentBudgetedMinor: 17500000, remainingMinor: 2500000, totalSpentMinor: 32000000, unbudgetedSpentMinor: 14500000 };
  const card = renderBudget(summary);
  assert.equal(card.props.accessibilityLabel, 'Presupuesto general: quedan 18000000 ARS de 50000000, 64 por ciento usado. 1 categoría excedida');
  const money = flatten(card).find(node => node.type === 'Money');
  assert.equal(money.props.minor, 18000000, 'what is left of the ceiling, never the sum of sublimits');
  const texts = flatten(card).filter(node => node.type === 'AppText').map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children));
  assert.ok(texts.includes('Presupuesto general · te queda'));
  assert.ok(texts.includes('de $ 50000000 · 64 %'));
  assert.ok(texts.includes('1 categoría excedida'));
  const exceeded = renderBudget({ ...summary, total: progress(totalBudget, 60000000), rows: [] });
  assert.match(exceeded.props.accessibilityLabel, /^Presupuesto general: excedido en 10000000 ARS de 50000000, 120 por ciento usado\.$/);
});

test('without a general budget the Home card falls back to the tightest sublimit and says how many there are', () => {
  const { renderBudget } = harness();
  const card = renderBudget({ currency: 'ARS', monthISO: '2026-09', total: null, rows: [funRow, foodRow],
    budgetedMinor: 20000000, spentBudgetedMinor: 17500000, remainingMinor: 2500000, totalSpentMinor: 32000000, unbudgetedSpentMinor: 14500000 });
  assert.equal(card.props.accessibilityLabel, 'Ocio: excedido en 500000 ARS de 5000000, 110 por ciento usado. 2 categorías · 1 excedida');
  assert.equal(flatten(card).find(node => node.type === 'Money').props.minor, 500000);
  assert.equal(flatten(card).some(node => node.type === 'Money' && node.props.minor === 2500000), false, 'no summed remaining');
  const single = renderBudget({ currency: 'ARS', monthISO: '2026-09', total: null, rows: [foodRow], budgetedMinor: 15000000, spentBudgetedMinor: 12000000, remainingMinor: 3000000, totalSpentMinor: 12000000, unbudgetedSpentMinor: 0 });
  assert.equal(single.props.accessibilityLabel, 'Comida: quedan 3000000 ARS de 15000000, 80 por ciento usado. Límite por categoría');
  assert.equal(renderBudget({ currency: 'ARS', monthISO: '2026-09', total: null, rows: [], budgetedMinor: 0, spentBudgetedMinor: 0, remainingMinor: 0, totalSpentMinor: 0, unbudgetedSpentMinor: 0 }), null);
});
