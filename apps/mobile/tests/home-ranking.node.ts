import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as uiPresentation from '../src/ui/presentation.ts';
import * as presentation from '../src/ui/report-presentation.ts';
import * as budgetPresentation from '../src/ui/budget-presentation.ts';
import { washOf } from '../src/ui/category-color.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
// Read on every render, like the live provider; a test may switch it and must restore it.
let current: AppLocale = 'es-AR';
const i18nProvider = { useI18n: () => bindLocale(current) };

// A source/behaviour guard over the Home category module: honest proportions,
// a reveal that runs once, interpolation on data changes and Reduce Motion.
// Frame pacing and the look of the tinted fill remain device acceptance items.
type Shared = { value: unknown };

function harness() {
  const source = readFileSync(new URL('../src/ui/home-modules.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  // Hooks persist by call order across renders, like React's, so a re-render keeps its refs and shared values.
  const env = { reduced: false, shared: [] as (Shared & { initial: unknown })[], refs: [] as { current: unknown }[], cursor: { shared: 0, ref: 0 }, alerts: [] as unknown[][] };
  const modules: Record<string, any> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useEffect: (fn: () => any) => { fn(); }, useRef: (value: unknown) => {
      const index = env.cursor.ref++;
      return env.refs[index] ??= { current: value }; } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Alert: { alert: (...args: unknown[]) => { env.alerts.push(args); } }, StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 }, View: 'View', useWindowDimensions: () => ({ fontScale: 1 }) },
    'expo-router': { router: { push: () => {} } },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' },
      useSharedValue: (value: unknown) => { const index = env.cursor.shared++; return env.shared[index] ??= { value, initial: value }; },
      useAnimatedStyle: (fn: () => any) => fn,
      withTiming: (value: number, options: { duration: number }) => ({ value, duration: options.duration, delay: 0 }),
      withDelay: (delay: number, animation: { value: number; duration: number }) => ({ ...animation, delay }) },
    '@finanzapp/domain': { formatMinorUnits: (minor: number) => String(minor), labelFromISO: () => '' },
    './components': { AppText: 'AppText', CategoryBadge: 'CategoryBadge', MerchantBadge: 'MerchantBadge', Money: 'Money', PressFeedback: 'PressFeedback', Surface: 'Surface', useStacked: () => false },
    './category-color': { washOf },
    './category-hues': { useCategoryColor: (label: string) => '#' + label.length.toString().padStart(6, 'A'), useCategoryLook: (label: string) => ({ label, hex: '#' + label.length.toString().padStart(6, 'A'), glyph: 'pricetag-outline' }) },
    './presentation': uiPresentation, './motion': { easeOut: 'ease-out', timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : 260 }) },
    './report-presentation': presentation,
    './budget-presentation': budgetPresentation,
    './theme': { useReduceMotion: () => env.reduced, usePalette: () => ({ line: '#ddd', isDark: true, secondary: '#A0A0A8', tertiary: '#7C7C84' }) },
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
  return { env, render, renderBudget, exports: module.exports };
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
  assert.match(rows[1].props.accessibilityLabel, /ocio, 1,00 ARS, 0,1\u00A0% del gasto del mes/);
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
  // VoiceOver hears ungrouped amounts in the language's decimal mark; the caption keeps the region's grouping.
  assert.equal(card.props.accessibilityLabel, 'Presupuesto general: quedan 180000,00 ARS de 500000,00, 64 por ciento usado. 1 categoría excedida');
  const money = flatten(card).find(node => node.type === 'Money');
  assert.equal(money.props.minor, 18000000, 'what is left of the ceiling, never the sum of sublimits');
  const texts = flatten(card).filter(node => node.type === 'AppText').map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children));
  assert.ok(texts.includes('Presupuesto general · te queda'));
  assert.ok(texts.includes('de $\u00A0500.000,00 · 64 %'));
  assert.ok(texts.includes('1 categoría excedida'));
  const exceeded = renderBudget({ ...summary, total: progress(totalBudget, 60000000), rows: [] });
  assert.match(exceeded.props.accessibilityLabel, /^Presupuesto general: excedido en 100000,00 ARS de 500000,00, 120 por ciento usado\.$/);
});

test('without a general budget the Home card falls back to the tightest sublimit and says how many there are', () => {
  const { renderBudget } = harness();
  const card = renderBudget({ currency: 'ARS', monthISO: '2026-09', total: null, rows: [funRow, foodRow],
    budgetedMinor: 20000000, spentBudgetedMinor: 17500000, remainingMinor: 2500000, totalSpentMinor: 32000000, unbudgetedSpentMinor: 14500000 });
  assert.equal(card.props.accessibilityLabel, 'Ocio: excedido en 5000,00 ARS de 50000,00, 110 por ciento usado. 2 categorías · 1 excedida');
  assert.equal(flatten(card).find(node => node.type === 'Money').props.minor, 500000);
  assert.equal(flatten(card).some(node => node.type === 'Money' && node.props.minor === 2500000), false, 'no summed remaining');
  const single = renderBudget({ currency: 'ARS', monthISO: '2026-09', total: null, rows: [foodRow], budgetedMinor: 15000000, spentBudgetedMinor: 12000000, remainingMinor: 3000000, totalSpentMinor: 12000000, unbudgetedSpentMinor: 0 });
  assert.equal(single.props.accessibilityLabel, 'Comida: quedan 30000,00 ARS de 150000,00, 80 por ciento usado. Límite por categoría');
  assert.equal(renderBudget({ currency: 'ARS', monthISO: '2026-09', total: null, rows: [], budgetedMinor: 0, spentBudgetedMinor: 0, remainingMinor: 0, totalSpentMinor: 0, unbudgetedSpentMinor: 0 }), null);
});

test('Producto 23.1C2: the budget card speaks the same amounts in every locale, and the caption keeps the region\'s grouping', () => {
  const { renderBudget } = harness();
  const summary = { currency: 'ARS', monthISO: '2026-09', total: progress(totalBudget, 32000000), rows: [],
    budgetedMinor: 0, spentBudgetedMinor: 0, remainingMinor: 0, totalSpentMinor: 32000000, unbudgetedSpentMinor: 0 };
  const expected: [AppLocale, string, string][] = [
    ['es-AR', 'Presupuesto general: quedan 180000,00 ARS de 500000,00, 64 por ciento usado.', 'de $\u00A0500.000,00 · 64 %'],
    ['en-AR', 'Overall budget: 180000.00 ARS left of 500000.00, 64 percent used.', 'of $\u00A0500.000,00 · 64%'],
    ['es-US', 'Presupuesto general: quedan 180000,00 ARS de 500000,00, 64 por ciento usado.', 'de AR$\u00A0500,000.00 · 64 %'],
    ['en-US', 'Overall budget: 180000.00 ARS left of 500000.00, 64 percent used.', 'of AR$\u00A0500,000.00 · 64%'],
  ];
  try {
    for (const [locale, label, caption] of expected) {
      current = locale;
      const card = renderBudget(summary);
      assert.equal(card.props.accessibilityLabel, label, locale);
      assert.doesNotMatch(card.props.accessibilityLabel, /[.,]\d{3}(?!\d)/, locale + ': no separator a voice could read as a decimal before three digits');
      const texts = flatten(card).filter(node => node.type === 'AppText').map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children));
      assert.ok(texts.includes(caption), locale + ': ' + texts.join(' | '));
    }
  } finally { current = 'es-AR'; }
});

test('the metric help opens a native alert whose button is named in the interface language, never left to iOS', () => {
  const { env, exports } = harness();
  try {
    for (const locale of ['es-AR', 'en-US'] as AppLocale[]) {
      current = locale;
      env.alerts.length = 0;
      const help = exports.MetricHelp({ title: 'Disponible', detail: 'Es el dinero registrado.' });
      assert.equal(help.props.accessibilityLabel, locale === 'es-AR' ? 'Qué significa Disponible' : 'What Disponible means');
      assert.equal(help.props.accessibilityRole, 'button');
      assert.deepEqual([help.props.children.type, help.props.children.props.color, help.props.children.props.size], ['Ionicons', '#A0A0A8', 18], '24UX1: the glyph is a control drawn in secondary ink, never tertiary');
      help.props.onPress();
      assert.equal(JSON.stringify(env.alerts), JSON.stringify([['Disponible', 'Es el dinero registrado.', [{ text: 'OK', style: 'cancel' }]]]), locale + ': one explicit button from the catalogue, still the cancel action (Esc and the escape gesture close it)');
    }
  } finally { current = 'es-AR'; }
});

test('an upcoming commitment reads its day inside the VoiceOver sentence in lower case, and keeps the capital where the caption starts', () => {
  const { exports } = harness();
  const rule = { id: 'r', merchant: 'Netflix', category: 'Suscripciones', kind: 'expense', amountMinor: 1234567, nextDateISO: '2026-09-22', accountId: 'a' };
  const account = { id: 'a', name: 'Banco', currency: 'ARS' };
  const caption = (row: any) => flatten(row).filter(node => node.type === 'AppText').map(node => [node.props.children].flat().join(''));
  try {
    const spanish = exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: true });
    assert.equal(spanish.props.accessibilityLabel, 'Netflix, Suscripciones, 12345,67 ARS, próximo pago hoy');
    // 24UX2: the caption is the category (the secondary signal); the day appears once, beside the amount, capitalised.
    assert.equal(JSON.stringify(caption(spanish)), JSON.stringify(['Netflix', 'Suscripciones', 'Hoy']));
    current = 'en-US';
    const english = exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: true, showAccount: true });
    assert.equal(english.props.accessibilityLabel, 'Netflix, Suscripciones, 12345.67 ARS, next payment today, Banco');
    assert.ok(caption(english).includes('Suscripciones · Banco'), 'the account only when another could be meant');
    assert.ok(caption(english).includes('Today'));
    // A later day is the short date either way; within a week a count of days.
    const later = exports.UpcomingRecurringRow({ rule: { ...rule, nextDateISO: '2026-10-01' }, account, day: '2026-09-22', last: true });
    assert.equal(later.props.accessibilityLabel, 'Netflix, Suscripciones, 12345.67 ARS, next payment Oct 1');
    assert.ok(caption(later).includes('Oct 1'));
    assert.ok(caption(exports.UpcomingRecurringRow({ rule: { ...rule, nextDateISO: '2026-09-26' }, account, day: '2026-09-22', last: true })).includes('In 4 days'));
  } finally { current = 'es-AR'; }
});

test('24UX5: an upcoming commitment names its category only when asked; the day stays under the amount and VoiceOver keeps everything', () => {
  const { exports } = harness();
  const rule = { id: 'r', merchant: 'Netflix', category: 'Suscripciones', kind: 'expense', amountMinor: 100, nextDateISO: '2026-09-23', accountId: 'a' };
  const account = { id: 'a', name: 'Banco', currency: 'ARS' };
  const texts = (row: any) => flatten(row).filter(node => node.type === 'AppText').map(node => [node.props.children].flat().join(''));
  const bare = exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: true, showCategory: false });
  assert.equal(JSON.stringify(texts(bare)), JSON.stringify(['Netflix', 'Mañana']), 'name, then the day under the amount');
  assert.equal(bare.props.accessibilityLabel, 'Netflix, Suscripciones, 1,00 ARS, próximo pago 23 sep');
  const withAccount = exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: true, showCategory: false, showAccount: true });
  assert.equal(JSON.stringify(texts(withAccount)), JSON.stringify(['Netflix', 'Banco', 'Mañana']));
  const urgent = flatten(bare).filter(node => node.type === 'AppText').at(-1);
  assert.equal(urgent.props.style.fontWeight, '600', 'tomorrow is urgent (the warning tone)');
});

test('24UX2: an upcoming commitment draws its merchant mark with the category behind it, never instead of the category name', () => {
  const { exports } = harness();
  const rule = { id: 'r', merchant: 'Netflix', category: 'Suscripciones', kind: 'expense', amountMinor: 100, nextDateISO: '2026-09-23', accountId: 'a' };
  const row = exports.UpcomingRecurringRow({ rule, account: { id: 'a', name: 'Banco', currency: 'ARS' }, day: '2026-09-22', last: true });
  const badge = flatten(row).find(node => node.type === 'MerchantBadge');
  assert.equal(JSON.stringify([badge.props.merchant, badge.props.category, badge.props.kind]), JSON.stringify(['Netflix', 'Suscripciones', 'expense']));
  assert.equal(flatten(row).some(node => node.type === 'CategoryBadge'), false, 'the badge owns its fallback to the category glyph');
});

test('24UX3: the category summary is compact and the commitments are an agenda on the ground', () => {
  const { render, exports } = harness();
  const { rows } = render({ categories: [category('comida', 600), category('ocio', 400)], totalMinor: 1000, currency: 'ARS', onPressCategory: () => {} });
  for (const row of rows) {
    assert.equal(row.props.style[0].minHeight, 52, 'a glance, not a ledger row');
    assert.equal(flatten(row).find(node => node.type === 'CategoryBadge').props.size, 32);
    assert.equal(flatten(row).find(node => node.type === 'Money').props.size, 15);
  }
  const rule = { id: 'r', merchant: 'Netflix', category: 'Suscripciones', kind: 'expense', amountMinor: 100, nextDateISO: '2026-09-23', accountId: 'a' };
  const account = { id: 'a', name: 'Banco', currency: 'ARS' };
  const row = exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: false });
  assert.equal(row.props.feedback, 'opacity', 'no cell to tint on the ground: the press answer is a dim');
  assert.equal(row.props.style.paddingHorizontal, undefined, 'aligned with the section title, no inset card padding');
  assert.equal(flatten(row).find(node => node.type === 'MerchantBadge').props.size, undefined, '24UX5: the 40 pt mark of the latest transactions');
  assert.equal(row.props.style.minHeight, 56, 'the agenda stays tighter than the 64 pt ledger rows');
  const content = row.props.children[1];
  assert.equal(content.props.style.paddingVertical, 8);
  assert.equal(content.props.style.borderBottomWidth, 0.5, 'the hairline starts under the text, not under the mark');
  assert.equal(exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: true }).props.children[1].props.style.borderBottomWidth, 0);
});
